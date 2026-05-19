export const successResponse = (
    message: string,
    data?: unknown
  ) => ({
    success: true,
    message,
    data
  });
  