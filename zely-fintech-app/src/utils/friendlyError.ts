// utils/friendlyError.ts
export const getFriendlyError = (
  err: any,
): { title: string; message: string } => {
  const status = err?.response?.status;

  // No response at all: offline, DNS, CORS, server down
  if (!err?.response) {
    return {
      title: "Connection problem",
      message:
        "We couldn't reach our servers. Please check your internet connection and try again.",
    };
  }

  if (status === 503 || status === 502 || status === 504) {
    return {
      title: "Service temporarily unavailable",
      message:
        "We're having a brief issue on our side. Please try again in a few moments.",
    };
  }

  if (status === 429) {
    return {
      title: "Too many attempts",
      message: "Please wait a minute before trying again.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      title: "Session expired",
      message: "Please log in again to continue.",
    };
  }

  if (status >= 500) {
    return {
      title: "Something went wrong",
      message: "An unexpected error occurred on our side. Please try again.",
    };
  }

  // 4xx: use the server's message only if it's safe to show
  return {
    title: "Something went wrong",
    message:
      err?.response?.data?.message ||
      "We couldn't complete that request. Please try again.",
  };
};
