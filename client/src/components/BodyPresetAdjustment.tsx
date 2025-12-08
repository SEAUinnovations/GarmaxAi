import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export interface PersonProfile {
  estimatedAge?: number;
  gender?: 'male' | 'female' | 'neutral';
  ethnicity?: string;
  skinTone?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  estimatedHeight?: number;
  buildType?: 'slim' | 'average' | 'athletic' | 'plus-size';
  bodyShape?: string;
  preferredStyle?: string;
  faceShape?: string;
  facialFeatures?: string[];
  detailedDescription: string;
  imageHash: string;
  analyzedAt: Date;
  consentGiven: boolean;
}

export interface BodyPresetOptions {
  basePreset: 'slim' | 'average' | 'athletic' | 'plus-size';
  heightAdjustment: number; // -20 to +20 (percentage adjustment)
  skinToneAdjustment: 'darker' | 'same' | 'lighter';
  buildVariation: number; // -10 to +10 (fine-tuning within preset)
  customDescriptors: string[];
}

interface BodyPresetAdjustmentProps {
  personProfile?: PersonProfile;
  currentPreset?: BodyPresetOptions;
  onPresetChange: (preset: BodyPresetOptions) => void;
  onPreviewPrompt: (prompt: string) => void;
  className?: string;
}

const PRESET_DESCRIPTIONS = {
  slim: {
    title: 'Slim Build',
    description: 'Lean, slender physique with defined features',
    keywords: ['lean', 'slender', 'thin', 'defined', 'narrow shoulders']
  },
  average: {
    title: 'Average Build',
    description: 'Balanced, proportional body type',
    keywords: ['balanced', 'proportional', 'medium build', 'healthy weight']
  },
  athletic: {
    title: 'Athletic Build',
    description: 'Muscular, toned physique with broad shoulders',
    keywords: ['muscular', 'toned', 'fit', 'broad shoulders', 'defined abs']
  },
  'plus-size': {
    title: 'Plus-Size Build',
    description: 'Fuller figure with curvy proportions',
    keywords: ['curvy', 'full figure', 'plus-size', 'rounded features']
  }
};

const SKIN_TONE_ADJUSTMENTS = {
  darker: 'slightly darker skin tone',
  same: 'same skin tone',
  lighter: 'slightly lighter skin tone'
};

const HEIGHT_DESCRIPTORS = {
  '-20': 'petite',
  '-15': 'shorter than average',
  '-10': 'slightly shorter',
  '-5': 'below average height',
  '0': 'average height',
  '5': 'above average height',
  '10': 'slightly taller',
  '15': 'taller than average',
  '20': 'tall'
};

export const BodyPresetAdjustment: React.FC<BodyPresetAdjustmentProps> = ({
  personProfile,
  currentPreset,
  onPresetChange,
  onPreviewPrompt,
  className = ''
}) => {
  const [preset, setPreset] = useState<BodyPresetOptions>(currentPreset || {
    basePreset: personProfile?.buildType || 'average',
    heightAdjustment: 0,
    skinToneAdjustment: 'same',
    buildVariation: 0,
    customDescriptors: []
  });

  const [promptPreview, setPromptPreview] = useState('');

  // Update preset when personProfile changes
  useEffect(() => {
    if (personProfile && !currentPreset) {
      setPreset(prev => ({
        ...prev,
        basePreset: personProfile.buildType || 'average'
      }));
    }
  }, [personProfile, currentPreset]);

  // Generate prompt preview when preset changes
  useEffect(() => {
    const preview = generatePromptFromPreset(preset, personProfile);
    setPromptPreview(preview);
    onPreviewPrompt(preview);
  }, [preset, personProfile, onPreviewPrompt]);

  const generatePromptFromPreset = (options: BodyPresetOptions, profile?: PersonProfile): string => {
    const parts = [];
    
    // Base description from profile if available
    if (profile?.detailedDescription) {
      parts.push(profile.detailedDescription);
    }
    
    // Preset-specific descriptors
    const presetInfo = PRESET_DESCRIPTIONS[options.basePreset];
    parts.push(...presetInfo.keywords);
    
    // Height adjustment
    const heightKey = options.heightAdjustment.toString() as keyof typeof HEIGHT_DESCRIPTORS;
    if (HEIGHT_DESCRIPTORS[heightKey] && HEIGHT_DESCRIPTORS[heightKey] !== 'average height') {
      parts.push(HEIGHT_DESCRIPTORS[heightKey]);
    }
    
    // Skin tone adjustment
    if (options.skinToneAdjustment !== 'same') {
      parts.push(SKIN_TONE_ADJUSTMENTS[options.skinToneAdjustment]);
    }
    
    // Build variation
    if (options.buildVariation !== 0) {
      const variation = options.buildVariation > 0 ? 'more defined' : 'softer features';
      parts.push(variation);
    }
    
    // Custom descriptors
    if (options.customDescriptors.length > 0) {
      parts.push(...options.customDescriptors);
    }
    
    return `Professional fashion photography of ${parts.join(', ')}, high quality, detailed, photorealistic`;
  };

  const handlePresetChange = (newPreset: BodyPresetOptions) => {
    setPreset(newPreset);
    onPresetChange(newPreset);
  };

  const handleBasePresetChange = (basePreset: BodyPresetOptions['basePreset']) => {
    const newPreset = { ...preset, basePreset };
    handlePresetChange(newPreset);
  };

  const handleHeightChange = (value: number[]) => {
    const newPreset = { ...preset, heightAdjustment: value[0] };
    handlePresetChange(newPreset);
  };

  const handleSkinToneChange = (skinToneAdjustment: BodyPresetOptions['skinToneAdjustment']) => {
    const newPreset = { ...preset, skinToneAdjustment };
    handlePresetChange(newPreset);
  };

  const handleBuildVariationChange = (value: number[]) => {
    const newPreset = { ...preset, buildVariation: value[0] };
    handlePresetChange(newPreset);
  };

  const resetToOriginal = () => {
    const originalPreset: BodyPresetOptions = {
      basePreset: personProfile?.buildType || 'average',
      heightAdjustment: 0,
      skinToneAdjustment: 'same',
      buildVariation: 0,
      customDescriptors: []
    };
    handlePresetChange(originalPreset);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle>Body Preset Adjustment</CardTitle>
          <CardDescription>
            Customize body characteristics for better virtual try-on results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base Preset Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Base Body Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(PRESET_DESCRIPTIONS).map(([key, info]) => (
                <Button
                  key={key}
                  variant={preset.basePreset === key ? 'default' : 'outline'}
                  onClick={() => handleBasePresetChange(key as BodyPresetOptions['basePreset'])}
                  className="h-auto p-4 flex flex-col items-start"
                >
                  <span className="font-semibold">{info.title}</span>
                  <span className="text-sm text-muted-foreground text-left">
                    {info.description}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Height Adjustment */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">Height Adjustment</Label>
              <Badge variant="secondary">
                {HEIGHT_DESCRIPTORS[preset.heightAdjustment.toString() as keyof typeof HEIGHT_DESCRIPTORS]}
              </Badge>
            </div>
            <Slider
              value={[preset.heightAdjustment]}
              onValueChange={handleHeightChange}
              min={-20}
              max={20}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Shorter (-20%)</span>
              <span>Original</span>
              <span>Taller (+20%)</span>
            </div>
          </div>

          {/* Skin Tone Adjustment */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Skin Tone</Label>
            <div className="flex gap-2">
              {Object.entries(SKIN_TONE_ADJUSTMENTS).map(([key, label]) => (
                <Button
                  key={key}
                  variant={preset.skinToneAdjustment === key ? 'default' : 'outline'}
                  onClick={() => handleSkinToneChange(key as BodyPresetOptions['skinToneAdjustment'])}
                  size="sm"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Build Variation */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">Build Fine-Tuning</Label>
              <Badge variant="secondary">
                {preset.buildVariation === 0 
                  ? 'Standard' 
                  : preset.buildVariation > 0 
                    ? 'More Defined' 
                    : 'Softer Features'
                }
              </Badge>
            </div>
            <Slider
              value={[preset.buildVariation]}
              onValueChange={handleBuildVariationChange}
              min={-10}
              max={10}
              step={2}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Softer (-10)</span>
              <span>Standard</span>
              <span>More Defined (+10)</span>
            </div>
          </div>

          {/* Prompt Preview */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Generated Prompt Preview</Label>
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="text-muted-foreground">{promptPreview}</p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-3 pt-4">
            <Button onClick={resetToOriginal} variant="outline" className="flex-1">
              Reset to Original
            </Button>
            <Button 
              onClick={() => onPresetChange(preset)} 
              className="flex-1"
            >
              Apply Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};