import { IsNotEmpty } from 'class-validator';

export class UpdatePhotoRecommendDto {
  @IsNotEmpty()
  photoIds: number[];

  @IsNotEmpty()
  isRecommended: boolean;
}
