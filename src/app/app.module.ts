import { provideHttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { StatusBannerComponent } from './status-banner/status-banner.component';
import { FOOD_PROVIDER } from './core/food/food-provider';
import { OpenFoodFactsProvider } from './core/food/openfoodfacts.provider';

/** Systemwunsch "Bewegung reduzieren": Ionic-Animationen (Modals, Seitenwechsel, Toasts) ausschalten. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

@NgModule({
  declarations: [AppComponent, StatusBannerComponent],
  imports: [BrowserModule, IonicModule.forRoot({ mode: 'ios', animated: !prefersReducedMotion() }), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: FOOD_PROVIDER, useExisting: OpenFoodFactsProvider },
    provideHttpClient(),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
