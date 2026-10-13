import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Tab-Shell der App: hält die Bottom-Tab-Bar und den Tab-Router-Outlet. */
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsPage {}
