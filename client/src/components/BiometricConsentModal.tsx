import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Info, Shield, TrendingDown, Clock, Trash2 } from 'lucide-react';

export interface BiometricConsentOptions {
  facialAnalysis: boolean;
  bodyAnalysis: boolean;
  stylePreferences: boolean;
  cacheEnabled: boolean;
  dataRetention: '30' | '60' | '90' | 'manual';
}

interface BiometricConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsentChange: (consent: BiometricConsentOptions) => void;
  currentConsent?: BiometricConsentOptions;
  showCostSavings?: boolean;
  className?: string;
}

const DEFAULT_CONSENT: BiometricConsentOptions = {
  facialAnalysis: false,
  bodyAnalysis: false,
  stylePreferences: false,
  cacheEnabled: false,
  dataRetention: '90'
};

const ANALYSIS_BENEFITS = {
  facialAnalysis: {
    title: 'Facial Feature Analysis',
    description: 'Preserves your unique facial characteristics for realistic try-on results',
    benefits: ['Accurate face shape preservation', 'Natural skin tone matching', 'Consistent eye and hair color'],
    cost: '$0.02 per analysis',
    savingsWithCache: 'Up to 95% cost reduction with caching'
  },
  bodyAnalysis: {
    title: 'Body Measurements Analysis',
    description: 'Analyzes body proportions for better garment fitting visualization',
    benefits: ['Accurate size representation', 'Better fit visualization', 'Proportional garment scaling'],
    cost: '$0.01 per analysis',
    savingsWithCache: 'Up to 90% cost reduction with caching'
  },
  stylePreferences: {
    title: 'Style Preference Learning',
    description: 'Learns your style preferences to suggest better combinations',
    benefits: ['Personalized recommendations', 'Improved color matching', 'Style-appropriate suggestions'],
    cost: 'Free with basic analysis',
    savingsWithCache: 'Faster recommendations'
  }
};

const RETENTION_OPTIONS = {
  '30': { label: '30 days', description: 'Basic retention for recent sessions' },
  '60': { label: '60 days', description: 'Extended retention for regular users' },
  '90': { label: '90 days', description: 'Maximum retention (recommended)' },
  'manual': { label: 'Until deleted', description: 'Keep until you manually delete' }
};

export const BiometricConsentModal: React.FC<BiometricConsentModalProps> = ({
  isOpen,
  onClose,
  onConsentChange,
  currentConsent,
  showCostSavings = true,
  className = ''
}) => {
  const [consent, setConsent] = useState<BiometricConsentOptions>(
    currentConsent || DEFAULT_CONSENT
  );
  
  const [estimatedSavings, setEstimatedSavings] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update consent when prop changes
  useEffect(() => {
    if (currentConsent) {
      setConsent(currentConsent);
    }
  }, [currentConsent]);

  // Calculate estimated savings
  useEffect(() => {
    if (consent.cacheEnabled) {
      let savings = 0;
      if (consent.facialAnalysis) savings += 0.019; // 95% of $0.02
      if (consent.bodyAnalysis) savings += 0.009; // 90% of $0.01
      setEstimatedSavings(savings);
    } else {
      setEstimatedSavings(0);
    }
  }, [consent]);

  const handleConsentToggle = (key: keyof BiometricConsentOptions, value: boolean | string) => {
    const newConsent = { ...consent, [key]: value };
    
    // Auto-enable caching when any analysis is enabled
    if ((key === 'facialAnalysis' || key === 'bodyAnalysis') && value === true) {
      newConsent.cacheEnabled = true;
    }
    
    // Disable caching if no analysis is enabled
    if (!newConsent.facialAnalysis && !newConsent.bodyAnalysis) {
      newConsent.cacheEnabled = false;
    }
    
    setConsent(newConsent);
  };

  const handleSaveConsent = () => {
    onConsentChange(consent);
    onClose();
  };

  const handleDeleteAllData = () => {
    // TODO: Implement data deletion API call
    console.log('Deleting all biometric data...');
    // Show confirmation toast
  };

  const getTotalAnalysisTypes = () => {
    return [consent.facialAnalysis, consent.bodyAnalysis, consent.stylePreferences]
      .filter(Boolean).length;
  };

  const getEstimatedMonthlyCost = () => {
    const analysisPerMonth = 20; // Estimated usage
    let cost = 0;
    
    if (consent.facialAnalysis) cost += 0.02 * analysisPerMonth;
    if (consent.bodyAnalysis) cost += 0.01 * analysisPerMonth;
    
    if (consent.cacheEnabled) {
      cost *= 0.1; // 90% reduction with caching
    }
    
    return Math.round(cost * 100) / 100;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${className}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Biometric Data & Privacy Settings
          </DialogTitle>
          <DialogDescription>
            Control how your personal data is analyzed and stored for better virtual try-on results.
            All data is encrypted and you maintain full control.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Analysis Type Controls */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Analysis Preferences</h3>
            
            {Object.entries(ANALYSIS_BENEFITS).map(([key, info]) => {
              const isEnabled = consent[key as keyof BiometricConsentOptions] as boolean;
              
              return (
                <Card key={key} className={isEnabled ? "border-primary" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{info.title}</CardTitle>
                        <CardDescription>{info.description}</CardDescription>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked: boolean) => 
                          handleConsentToggle(key as keyof BiometricConsentOptions, checked)
                        }
                      />
                    </div>
                  </CardHeader>
                  
                  {isEnabled && (
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Benefits:</Label>
                          <ul className="text-sm mt-1 ml-4 space-y-1">
                            {info.benefits.map((benefit, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-primary rounded-full" />
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {showCostSavings && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Cost: {info.cost}</span>
                            {consent.cacheEnabled && (
                              <Badge variant="secondary" className="text-green-600">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                {info.savingsWithCache}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          <Separator />

          {/* Caching and Performance */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Performance & Caching</h3>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Smart Caching</CardTitle>
                    <CardDescription>
                      Cache your analysis results to reduce costs and improve speed
                    </CardDescription>
                  </div>
                  <Switch
                    checked={consent.cacheEnabled}
                    onCheckedChange={(checked: boolean) => handleConsentToggle('cacheEnabled', checked)}
                    disabled={!consent.facialAnalysis && !consent.bodyAnalysis}
                  />
                </div>
              </CardHeader>
              
              {consent.cacheEnabled && showCostSavings && (
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-green-600" />
                      <span>Estimated monthly savings: <strong>${estimatedSavings.toFixed(3)}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span>Faster processing: <strong>3-5x speed improvement</strong></span>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          <Separator />

          {/* Data Retention Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Data Retention</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Hide Advanced' : 'Advanced Settings'}
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Automatic Data Cleanup</CardTitle>
                <CardDescription>
                  Your biometric data will be automatically deleted after this period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(RETENTION_OPTIONS).map(([value, option]) => (
                    <Button
                      key={value}
                      variant={consent.dataRetention === value ? 'default' : 'outline'}
                      onClick={() => handleConsentToggle('dataRetention', value)}
                      className="h-auto p-3 flex flex-col items-start"
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground text-left">
                        {option.description}
                      </span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {showAdvanced && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-base text-destructive flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete All Data
                  </CardTitle>
                  <CardDescription>
                    Immediately delete all stored biometric data. This action cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteAllData}
                    className="w-full"
                  >
                    Delete All My Biometric Data
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary */}
          {getTotalAnalysisTypes() > 0 && (
            <>
              <Separator />
              <Card className="bg-muted">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Analysis types enabled:</span>
                    <Badge variant="outline">{getTotalAnalysisTypes()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Data retention:</span>
                    <Badge variant="outline">{RETENTION_OPTIONS[consent.dataRetention].label}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Caching enabled:</span>
                    <Badge variant={consent.cacheEnabled ? "default" : "secondary"}>
                      {consent.cacheEnabled ? "Yes" : "No"}
                    </Badge>
                  </div>
                  {showCostSavings && (
                    <div className="flex justify-between">
                      <span>Estimated monthly cost:</span>
                      <Badge variant="outline">${getEstimatedMonthlyCost()}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSaveConsent} className="flex-1">
            Save Preferences
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};