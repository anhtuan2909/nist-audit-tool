import { put } from '@vercel/blob';
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false, // Bắt buộc false để busboy tự xử lý stream
  },
};

export default async function handler(req, res) {
  // Chỉ cho phép method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Lấy tên khách hàng từ header (đã được frontend xử lý an toàn)
    const clientFolder = req.headers['x-client-name'] || 'general';
    const fileData = await new Promise((resolve, reject) => {
      const bb = Busboy({ headers: req.headers });
      let fileBuffer = null;
      let fileName = '';
      let fileContentType = '';

      // Bắt sự kiện khi có file
      bb.on('file', (name, file, info) => {
        fileName = info.filename;
        fileContentType = info.mimeType;
        
        const chunks = [];
        file.on('data', (chunk) => chunks.push(chunk));
        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      // Bắt sự kiện khi busboy xử lý xong toàn bộ request
      bb.on('finish', () => {
        if (fileBuffer && fileName) {
          resolve({ buffer: fileBuffer, filename: fileName, contentType: fileContentType });
        } else {
          reject(new Error('Không tìm thấy file trong request'));
        }
      });

      bb.on('error', (err) => reject(err));

      // Bắt đầu pipe request vào busboy
      req.pipe(bb);
    });

    // Thực hiện upload lên Vercel Blob
    // BLOB_READ_WRITE_TOKEN sẽ tự động được Vercel inject vào môi trường
    const blob = await put(`audit/${clientFolder}/${Date.now()}-${fileData.filename}`, fileData.buffer, {
      access: 'public',
      contentType: fileData.contentType
    });

    // Trả về URL cho client
    return res.status(200).json({ url: blob.url });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}