import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { StatusBannerComponent } from './status-banner/status-banner.component';
import { FOOD_PROVIDER } from './core/food/food-provider';
import { OpenFoodFactsProvider } from './core/food/openfoodfacts.provider';
import { nativeClientInterceptor } from './core/http/native-client.interceptor';
import { reducedMotionQuery } from './core/motion/reduced-motion';

/** Systemwunsch "Bewegung reduzieren": Ionic-Animationen (Modals, Seitenwechsel, Toasts) ausschalten. */
const PREFERS_REDUCED_MOTION = reducedMotionQuery()?.matches === true;

@NgModule({
  declarations: [AppComponent, StatusBannerComponent],
  imports: [BrowserModule, IonicModule.forRoot({ mode: 'ios', animated: !PREFERS_REDUCED_MOTION }), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: FOOD_PROVIDER, useExisting: OpenFoodFactsProvider },
    provideHttpClient(withInterceptors([nativeClientInterceptor])),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
