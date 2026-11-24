import type { BloomEffect } from 'postprocessing'
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  Vignette,
} from '@react-three/postprocessing'

type Scene1PostProcessingProps = {
  bloomRef: React.RefObject<BloomEffect>
}

export default function Scene1PostProcessing({
  bloomRef,
}: Scene1PostProcessingProps) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef as unknown as React.RefObject<never>}
        mipmapBlur
        luminanceThreshold={1.0}
        intensity={0.35}
      />
      <HueSaturation saturation={0.18} />
      <BrightnessContrast contrast={0.07} />
      <Vignette eskil={false} offset={0.22} darkness={0.32} />
    </EffectComposer>
  )
}
