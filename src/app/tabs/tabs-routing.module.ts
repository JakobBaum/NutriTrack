import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('../dashboard/dashboard.module').then((m) => m.DashboardPageModule),
      },
      {
        path: 'diary',
        loadChildren: () =>
          import('../diary/diary.module').then((m) => m.DiaryPageModule),
      },
      {
        path: 'recipes',
        loadChildren: () =>
          import('../recipes/recipes.module').then((m) => m.RecipesPageModule),
      },
      {
        path: 'shopping',
        loadChildren: () =>
          import('../shopping/shopping.module').then((m) => m.ShoppingPageModule),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../settings/settings.module').then((m) => m.SettingsPageModule),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
