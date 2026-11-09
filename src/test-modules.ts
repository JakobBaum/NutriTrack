// Seit @angular/build 22.2 kompiliert der Test-Builder nur Dateien, die von Specs/Setup erreichbar sind.
// Damit NgModule-Scopes der Komponenten bekannt sind, wird der Modulbaum hier eingebunden.
import "./app/app.module";
