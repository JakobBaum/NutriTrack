import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressRingComponent } from './progress-ring.component';

describe('ProgressRingComponent', () => {
  let fixture: ComponentFixture<ProgressRingComponent>;
  let ring: ProgressRingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [ProgressRingComponent] }).compileComponents();
    fixture = TestBed.createComponent(ProgressRingComponent);
    ring = fixture.componentInstance;
  });

  function set(value: number, max: number): void {
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('max', max);
    fixture.detectChanges();
  }

  it('berechnet Radius, Umfang und Mitte aus Größe und Strich', () => {
    set(0, 0);
    expect(ring.radius()).toBe(32);
    expect(ring.center()).toBe(36);
    expect(ring.circumference()).toBeCloseTo(2 * Math.PI * 32, 10);
  });

  it('bleibt bei max 0 oder negativ leer', () => {
    set(100, 0);
    expect(ring.dashOffset()).toBeCloseTo(ring.circumference(), 10);
    expect(ring.isOver()).toBe(false);
    set(100, -5);
    expect(ring.dashOffset()).toBeCloseTo(ring.circumference(), 10);
  });

  it('füllt anteilig und klemmt negative Werte auf 0', () => {
    set(50, 100);
    expect(ring.dashOffset()).toBeCloseTo(ring.circumference() / 2, 10);
    set(-20, 100);
    expect(ring.dashOffset()).toBeCloseTo(ring.circumference(), 10);
  });

  it('deckelt auf 100 % und nutzt bei Überschreitung die Warnfarbe', () => {
    set(150, 100);
    expect(ring.dashOffset()).toBe(0);
    expect(ring.isOver()).toBe(true);
    expect(ring.strokeColor()).toBe('var(--nt-over)');
  });

  it('warnt erst oberhalb der Schwelle warnAbove', () => {
    fixture.componentRef.setInput('warnAbove', 0.1);
    set(105, 100);
    expect(ring.isOver()).toBe(false);
    expect(ring.dashOffset()).toBe(0);
    set(111, 100);
    expect(ring.isOver()).toBe(true);
  });

  it('nutzt die Eingabefarbe ohne Überschreitung und rendert die Attribute', () => {
    fixture.componentRef.setInput('color', 'red');
    fixture.componentRef.setInput('size', 100);
    fixture.componentRef.setInput('stroke', 10);
    set(100, 100);
    expect(ring.strokeColor()).toBe('red');
    const value = fixture.nativeElement.querySelector('.ring__value') as SVGCircleElement;
    expect(value.getAttribute('r')).toBe('45');
    expect(value.getAttribute('stroke')).toBe('red');
  });
});
