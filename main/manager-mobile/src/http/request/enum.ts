export enum ResultEnum {
  Success = 0, // Success
  Error = 400, // Error
  Unauthorized = 401, // Unauthorized
  Forbidden = 403, // Forbidden
  NotFound = 404, // Not found
  MethodNotAllowed = 405, // Method not allowed
  RequestTimeout = 408, // Request timeout
  InternalServerError = 500, // Internal server error
  NotImplemented = 501, // Not implemented
  BadGateway = 502, // Bad gateway
  ServiceUnavailable = 503, // Service unavailable
  GatewayTimeout = 504, // Gateway timeout
  HttpVersionNotSupported = 505, // HTTP version not supported
  MixedContent = 600, // Mixed content error
}
export enum ContentTypeEnum {
  JSON = 'application/json;charset=UTF-8',
  FORM_URLENCODED = 'application/x-www-form-urlencoded;charset=UTF-8',
  FORM_DATA = 'multipart/form-data;charset=UTF-8',
}
