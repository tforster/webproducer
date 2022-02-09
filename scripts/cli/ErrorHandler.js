class ErrorHandler {
  async handleError(err) {
    console.error("CLI handling unhandled error", err);
    // TODO: Consider Winston or similar logging here
  }

  isTrustedError(error) {
    // if (error instanceof BaseError) {
    //   return error.isOperational;
    // }
    return false;
  }
}

export const ErrorHander = ErrorHandler;
// const errorHandler = new ErrorHandler();

// exports = errorHandler;
