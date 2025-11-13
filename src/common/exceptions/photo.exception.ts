import { BaseException } from "./base.exception";

export enum PhotoErrorCode {
  PHOTO_NOT_FOUND = 'Photo.NotFound',
  PHOTO_UPDATE_FAILED = 'Photo.UpdateFailed',
}

const PhotoExceptionMessages = {
  [PhotoErrorCode.PHOTO_NOT_FOUND]: '照片不存在',
  [PhotoErrorCode.PHOTO_UPDATE_FAILED]: '照片更新失败',
}

export class PhotoException extends BaseException {
  constructor(code: PhotoErrorCode, data: any = null, httpStatus: number = 400,) {
    super(code, PhotoExceptionMessages[code], data, httpStatus);
  }
}