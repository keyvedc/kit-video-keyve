// Formatos e padrões técnicos do motor (não dependem da marca).
export const FORMATS = {
  '9x16': { W: 1080, H: 1920, safe: { top: 250, bottom: 340, side: 60 } },
  '16x9': { W: 1920, H: 1080, safe: { top: 80, bottom: 80, side: 120 } },
  '1x1':  { W: 1080, H: 1080, safe: { top: 80, bottom: 80, side: 80 } },
  '4x5':  { W: 1080, H: 1350, safe: { top: 90, bottom: 120, side: 70 } },
};

// Valores padrão; o estilo ativo (estilos/<nome>/estilo.json) sobrescreve bpm, fps e molas.
export const MOTION = {
  bpm: 120,
  fps: 30,            // redes sociais: 30 fps bastam (use 24 se a filmagem for 24 fps)
  subframes: 4,       // só nos modos --media / --max
  shutter: 0.5,       // obturador de 180°
  spring: { stiffness: 220, damping: 22 },      // overshoot ~3%, assenta em ~0,45 s
  springSoft: { stiffness: 160, damping: 20 },
  cameraPush: [1.0, 1.04],
};
