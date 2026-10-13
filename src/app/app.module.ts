import { provideHttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { FOOD_PROVIDER } from './core/food/food-provider';
import { OpenFoodFactsProvider } from './core/food/openfoodfacts.provider';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: FOOD_PROVIDER, useExisting: OpenFoodFactsProvider },
    provideHttpClient(),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
