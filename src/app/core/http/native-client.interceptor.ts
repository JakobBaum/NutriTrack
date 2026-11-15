import { HttpInterceptorFn } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { defaultAiProxyUrl } from '../ai/ai-endpoint';
import { nativeClientHeaders, shouldMarkAsNativeClient } from './native-client-header';

/** Setzt auf der nativen Plattform für Worker-Aufrufe den Client-Header (im Browser nie). */
export const nativeClientInterceptor: HttpInterceptorFn = (req, next) => {
  if (!shouldMarkAsNativeClient(req.url, defaultAiProxyUrl(), Capacitor.isNativePlatform())) return next(req);
  return next(req.clone({ setHeaders: nativeClientHeaders() as Record<string, string> }));
};
