export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
}

export function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "Duplicate record"
    });
  }

  if (
    err.code === "ER_NO_REFERENCED_ROW_2" ||
    err.code === "ER_ROW_IS_REFERENCED_2"
  ) {
    return res.status(409).json({
      success: false,
      message: "Database relationship constraint failed"
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
}