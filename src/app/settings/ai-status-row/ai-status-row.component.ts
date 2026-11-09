import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AiService } from '../../core/ai/ai.service';

type AiStatus = 'checking' | 'ok' | 'down';

/**
 * KI-Status: reine Anzeige, ob der globale KI-Dienst erreichbar ist.
 * Es gibt nichts einzustellen. Ein Tipp prueft erneut.
 */
@Component({
  selector: 'app-ai-status-row',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-item button detail="false" data-testid="ai-status-row" [disabled]="status() === 'checking'" (click)="check()">
      <ion-icon slot="start" name="sparkles-outline"></ion-icon>
      <ion-label class="ion-text-wrap">
        KI-Status
        <p class="row-sub">Google Gemini über den NutriTrack-Server, nichts einzustellen.</p>
        @if (status() === 'down' && message()) {
          <p class="row-sub row-sub--warn" role="status">{{ message() }}</p>
        }
      </ion-label>
      <ion-note slot="end" class="row-note" data-testid="ai-status-badge" role="status">{{ badge() }}</ion-note>
    </ion-item>
  `,
  styles: [`
    :host { display: contents; }
    ion-item { --min-height: var(--nt-grouped-row-min); --background: transparent; }
    ion-icon[slot='start'] { color: var(--nt-accent); }
    .row-sub { margin: 2px 0 0; font-size: var(--nt-fs-caption); color: var(--nt-secondary); }
    .row-sub--warn { color: var(--nt-over); font-weight: 600; }
    .row-note { color: var(--nt-secondary); font-size: var(--nt-fs-body); white-space: nowrap; }
  `],
})
export class AiStatusRowComponent implements OnInit {
  private readonly ai = inject(AiService);

  readonly status = signal<AiStatus>('checking');
  readonly message = signal<string | null>(null);

  readonly badge = computed(() => {
    switch (this.status()) {
      case 'ok': return 'Verbunden';
      case 'down': return 'Nicht erreichbar';
      default: return 'Prüfe…';
    }
  });

  ngOnInit(): void {
    void this.check();
  }

  async check(): Promise<void> {
    this.status.set('checking');
    this.message.set(null);
    const result = await this.ai.testConnection();
    this.status.set(result.ok ? 'ok' : 'down');
    this.message.set(result.ok ? null : result.message);
  }
}
