import sharp from 'sharp';

async function compressImage(imageBuffer: Buffer): Promise<[Buffer, Buffer]> {
  return await Promise.all([
    sharp(imageBuffer)
      .resize({ width: 300, fit: 'inside' })
      .webp({ quality: 80 })
      .toBuffer(),
    sharp(imageBuffer)
      .resize({ width: 1920, fit: 'inside' })
      .webp({ quality: 80 })
      .toBuffer(),
  ]);
}

export default compressImage;
