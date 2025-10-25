import sharp from 'sharp';

// 压缩缩略图
export default async (buffer) => {
  const thumb = await sharp(buffer)
    .resize({ width: 300, fit: 'inside' })
    .rotate() // 自动根据 EXIF 信息旋转图片
    .webp({ quality: 70 })
    .toBuffer();

  const medium = await sharp(buffer)
    .resize({ width: 1920, fit: 'inside' })
    .rotate() // 自动根据 EXIF 信息旋转图片
    .webp({ quality: 80 })
    .toBuffer();

  return {
    thumb,
    medium
  }
};
