import { NextResponse } from "next/server";

/** Formato único de error de la API (HU-21): { error: { code, message, details[] } } */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details: { field?: string; message: string }[];
  };
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: ApiError["error"]["details"]
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: details ?? [],
      },
    },
    { status }
  );
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

