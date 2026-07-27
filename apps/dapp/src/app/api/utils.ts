import { type NextResponse } from 'next/server';

export type ApiResponseSuccess<T = void> = { success: true; data?: T };
export type ApiResponseError = { error: string };
export type ApiResponse<T = void> = Promise<NextResponse<ApiResponseSuccess<T> | ApiResponseError>>;
