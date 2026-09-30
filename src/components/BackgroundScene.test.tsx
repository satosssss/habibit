import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackgroundScene } from './BackgroundScene';

describe('BackgroundScene (slice D R3)', () => {
  it('renders three inert blobs behind the app', () => {
    const { container } = render(<BackgroundScene />);
    const scene = container.firstElementChild!;
    expect(scene.className).toContain('bg-scene');
    expect(scene.className).toContain('pointer-events-none');
    expect(scene).toHaveAttribute('aria-hidden', 'true');
    const blobs = scene.querySelectorAll('.blob');
    expect(blobs).toHaveLength(3);
    expect(scene.querySelector('.blob-1')).toBeInTheDocument();
    expect(scene.querySelector('.blob-2')).toBeInTheDocument();
    expect(scene.querySelector('.blob-3')).toBeInTheDocument();
  });
});
