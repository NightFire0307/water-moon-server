import { IsArray } from 'class-validator';

export class DeletePhotosDto {
  @IsArray({
    message: '照片ID必须是数组',
  })
  photoIds: number[];
}
