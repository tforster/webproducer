class ErrorHandler {
  async handleError(err) {
    console.error("API handling unhandled error", err);
    // TODO: Consider Winston or similar logging here
  }

  isTrustedError(error) {
    // if (error instanceof BaseError) {
    //   return error.isOperational;
    // }
    return false;
  }
}

const errorHandler = new ErrorHandler();

export default errorHandler.handleError;
