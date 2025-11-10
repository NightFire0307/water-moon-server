import { BaseException } from "./base.exception";

export enum ProductErrorCode {
  PRODUCT_NOT_FOUND = 'Product.NotFound',
  PRODUCT_NOT_USABLE = 'Product.NotUsable',
  PRODUCT_TYPE_INVALID = 'Product.TypeInvalid',
  PRODUCT_UPDATE_FAILED = 'Product.UpdateFailed',
  PRODUCT_TYPE_NOT_FOUND = 'Product.TypeNotFound',
  PRODUCT_NAME_ALREADY_EXISTS = 'Product.NameAlreadyExists',
  PRODUCT_PHOTO_SELECTION_EXCEED_LIMIT = 'Product.PhotoSelectionExceedLimit'
}

const ProductExceptionMessages = {
  [ProductErrorCode.PRODUCT_NOT_FOUND]: '产品不存在',
  [ProductErrorCode.PRODUCT_NOT_USABLE]: '产品不可用',
  [ProductErrorCode.PRODUCT_TYPE_INVALID]: '产品类型无效',
  [ProductErrorCode.PRODUCT_UPDATE_FAILED]: '产品更新失败',
  [ProductErrorCode.PRODUCT_TYPE_NOT_FOUND]: '产品类型不存在',
  [ProductErrorCode.PRODUCT_NAME_ALREADY_EXISTS]: '产品名称已存在',
  [ProductErrorCode.PRODUCT_PHOTO_SELECTION_EXCEED_LIMIT]: '当前产品的照片数量已超过限制',
}

export class ProductException extends BaseException {
  constructor(code: ProductErrorCode, data: any = null, httpStatus: number = 400,) {
    super(code, ProductExceptionMessages[code], data, httpStatus);
  }
}