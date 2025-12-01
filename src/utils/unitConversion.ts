export interface HeightMeasurement {
  feet?: number;
  inches?: number;
  totalInches?: number;
  centimeters?: number;
  meters?: number;
}

export class UnitConverter {
  // Imperial to Metric conversions
  static inchesToCentimeters(inches: number): number {
    return Math.round(inches * 2.54);
  }
  
  static feetInchesToCentimeters(feet: number, inches: number): number {
    const totalInches = (feet * 12) + inches;
    return this.inchesToCentimeters(totalInches);
  }
  
  static feetInchesToMeters(feet: number, inches: number): number {
    return Math.round((this.feetInchesToCentimeters(feet, inches) / 100) * 100) / 100;
  }
  
  // Metric to Imperial conversions
  static centimetersToInches(cm: number): number {
    return Math.round(cm / 2.54);
  }
  
  static centimetersToFeetInches(cm: number): { feet: number; inches: number } {
    const totalInches = this.centimetersToInches(cm);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return { feet, inches };
  }
  
  static metersToFeetInches(meters: number): { feet: number; inches: number } {
    return this.centimetersToFeetInches(meters * 100);
  }
  
  // Height formatting utilities
  static formatHeight(measurement: HeightMeasurement, system: 'imperial' | 'metric'): string {
    if (system === 'metric') {
      if (measurement.centimeters) {
        return `${measurement.centimeters} cm`;
      } else if (measurement.meters) {
        return `${measurement.meters} m`;
      } else if (measurement.feet !== undefined && measurement.inches !== undefined) {
        const cm = this.feetInchesToCentimeters(measurement.feet, measurement.inches);
        return `${cm} cm`;
      }
    } else {
      if (measurement.feet !== undefined && measurement.inches !== undefined) {
        return `${measurement.feet}'${measurement.inches}"`;
      } else if (measurement.centimeters) {
        const { feet, inches } = this.centimetersToFeetInches(measurement.centimeters);
        return `${feet}'${inches}"`;
      } else if (measurement.meters) {
        const { feet, inches } = this.metersToFeetInches(measurement.meters);
        return `${feet}'${inches}"`;
      }
    }
    return 'Not set';
  }
  
  // Create height measurement object from different inputs
  static createHeightMeasurement(
    input: { feet: number; inches: number } | { centimeters: number } | { meters: number }
  ): HeightMeasurement {
    if ('feet' in input && 'inches' in input) {
      return {
        feet: input.feet,
        inches: input.inches,
        totalInches: (input.feet * 12) + input.inches,
        centimeters: this.feetInchesToCentimeters(input.feet, input.inches),
        meters: this.feetInchesToMeters(input.feet, input.inches)
      };
    } else if ('centimeters' in input) {
      const { feet, inches } = this.centimetersToFeetInches(input.centimeters);
      return {
        feet,
        inches,
        totalInches: this.centimetersToInches(input.centimeters),
        centimeters: input.centimeters,
        meters: Math.round((input.centimeters / 100) * 100) / 100
      };
    } else if ('meters' in input) {
      const cm = Math.round(input.meters * 100);
      const { feet, inches } = this.centimetersToFeetInches(cm);
      return {
        feet,
        inches,
        totalInches: this.centimetersToInches(cm),
        centimeters: cm,
        meters: input.meters
      };
    }
    
    throw new Error('Invalid height measurement input');
  }
  
  // Validation helpers
  static isValidImperialHeight(feet: number, inches: number): boolean {
    return feet >= 4 && feet <= 7 && inches >= 0 && inches <= 11;
  }
  
  static isValidMetricHeight(cm: number): boolean {
    return cm >= 120 && cm <= 220; // ~4'0" to ~7'2"
  }
  
  static isValidMetricHeightMeters(meters: number): boolean {
    return meters >= 1.2 && meters <= 2.2; // 1.2m to 2.2m
  }
  
  // Get height ranges for dropdowns
  static getImperialHeightOptions(): { feet: number[]; inches: number[] } {
    return {
      feet: [4, 5, 6, 7],
      inches: Array.from({ length: 12 }, (_, i) => i) // 0-11
    };
  }
  
  static getMetricHeightOptions(): number[] {
    // Generate array from 120cm to 220cm in 1cm increments
    return Array.from({ length: 101 }, (_, i) => 120 + i);
  }
  
  // Convert user preference between systems
  static convertUserHeightPreference(
    currentHeight: { feet?: number; inches?: number; centimeters?: number },
    targetSystem: 'imperial' | 'metric'
  ): { feet?: number; inches?: number; centimeters?: number } {
    if (targetSystem === 'metric') {
      if (currentHeight.feet !== undefined && currentHeight.inches !== undefined) {
        return {
          centimeters: this.feetInchesToCentimeters(currentHeight.feet, currentHeight.inches)
        };
      }
    } else {
      if (currentHeight.centimeters !== undefined) {
        const { feet, inches } = this.centimetersToFeetInches(currentHeight.centimeters);
        return { feet, inches };
      }
    }
    
    return currentHeight; // Return unchanged if no conversion needed
  }
}

// Weight conversion utilities (bonus feature)
export class WeightConverter {
  static poundsToKilograms(pounds: number): number {
    return Math.round((pounds * 0.453592) * 10) / 10;
  }
  
  static kilogramsToPounds(kg: number): number {
    return Math.round((kg * 2.20462) * 10) / 10;
  }
  
  static formatWeight(weight: number, system: 'imperial' | 'metric'): string {
    if (system === 'metric') {
      return `${weight} kg`;
    } else {
      return `${weight} lbs`;
    }
  }
  
  static isValidWeight(weight: number, system: 'imperial' | 'metric'): boolean {
    if (system === 'metric') {
      return weight >= 40 && weight <= 200; // 40kg to 200kg
    } else {
      return weight >= 88 && weight <= 440; // ~88lbs to ~440lbs
    }
  }
}