import { ArrayNotEmpty, IsNotEmpty } from 'class-validator';

export class UpdatePhotoRecommendDto {
  @IsNotEmpty()
  @ArrayNotEmpty()
  photoIds: number[];

  @IsNotEmpty()
  isRecommended: boolean;
}
