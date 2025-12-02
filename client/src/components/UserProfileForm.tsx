"use client"

import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckIcon, StarIcon } from "lucide-react"

// Validation schema
const profileFormSchema = z.object({
  heightFeet: z.number().min(4).max(7).optional(),
  heightInches: z.number().min(0).max(11).optional(),
  heightCentimeters: z.number().min(120).max(220).optional(),
  ageRange: z.enum(['18-25', '26-35', '36-45', '46-55', '55+']),
  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']),
  bodyType: z.enum(['slim', 'average', 'athletic', 'plus-size']),
  ethnicity: z.string().optional(),
  stylePreferences: z.array(z.string()).optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

interface UserProfileFormProps {
  initialData?: Partial<ProfileFormValues>
  onSubmit: (data: ProfileFormValues) => Promise<void>
  isLoading?: boolean
  className?: string
}

const STYLE_OPTIONS = [
  'casual', 'formal', 'streetwear', 'bohemian', 'minimalist', 
  'vintage', 'sporty', 'elegant', 'edgy', 'romantic'
]

export function UserProfileForm({ 
  initialData, 
  onSubmit, 
  isLoading = false,
  className = "" 
}: UserProfileFormProps) {
  const [selectedStyles, setSelectedStyles] = useState<string[]>(initialData?.stylePreferences || [])
  const [completionPercentage, setCompletionPercentage] = useState(0)
  const [measurementSystem, setMeasurementSystem] = useState<'imperial' | 'metric'>('imperial')
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      heightFeet: measurementSystem === 'imperial' ? (initialData?.heightFeet || 5) : undefined,
      heightInches: measurementSystem === 'imperial' ? (initialData?.heightInches || 6) : undefined,
      heightCentimeters: measurementSystem === 'metric' ? (initialData?.heightCentimeters || 170) : undefined,
      ageRange: initialData?.ageRange || '26-35',
      gender: initialData?.gender || 'prefer-not-to-say',
      bodyType: initialData?.bodyType || 'average',
      ethnicity: initialData?.ethnicity || '',
      stylePreferences: initialData?.stylePreferences || [],
    },
  })
  
  // Calculate completion percentage when form values change
  const watchedValues = form.watch()
  const calculateCompletion = () => {
    const requiredFields = ['heightFeet', 'heightInches', 'ageRange', 'gender', 'bodyType']
    const optionalFields = ['ethnicity']
    
    let completed = 0
    const total = requiredFields.length + optionalFields.length
    
    // Check required fields
    requiredFields.forEach(field => {
      const value = watchedValues[field as keyof ProfileFormValues]
      if (value !== undefined && value !== '' && value !== null) {
        completed++
      }
    })
    
    // Check optional fields
    if (watchedValues.ethnicity && watchedValues.ethnicity.trim().length >= 2) {
      completed++
    }
    
    const percentage = Math.round((completed / total) * 100)
    if (percentage !== completionPercentage) {
      setCompletionPercentage(percentage)
    }
  }
  
  // Recalculate on form changes
  useEffect(() => {
    calculateCompletion()
  }, [watchedValues])
  
  const handleStyleToggle = (style: string) => {
    const newStyles = selectedStyles.includes(style)
      ? selectedStyles.filter(s => s !== style)
      : [...selectedStyles, style]
    
    setSelectedStyles(newStyles)
    form.setValue('stylePreferences', newStyles)
  }
  
  // Convert height between systems
  const convertHeight = (fromSystem: 'imperial' | 'metric', toSystem: 'imperial' | 'metric') => {
    const values = form.getValues()
    if (fromSystem === 'imperial' && toSystem === 'metric' && values.heightFeet && values.heightInches !== undefined) {
      const totalInches = (values.heightFeet * 12) + values.heightInches
      const cm = Math.round(totalInches * 2.54)
      form.setValue('heightCentimeters', cm)
      form.setValue('heightFeet', undefined)
      form.setValue('heightInches', undefined)
    } else if (fromSystem === 'metric' && toSystem === 'imperial' && values.heightCentimeters) {
      const totalInches = Math.round(values.heightCentimeters / 2.54)
      const feet = Math.floor(totalInches / 12)
      const inches = totalInches % 12
      form.setValue('heightFeet', feet)
      form.setValue('heightInches', inches)
      form.setValue('heightCentimeters', undefined)
    }
  }
  
  const handleMeasurementSystemChange = (newSystem: 'imperial' | 'metric') => {
    if (newSystem !== measurementSystem) {
      convertHeight(measurementSystem, newSystem)
      setMeasurementSystem(newSystem)
    }
  }
  
  const handleSubmit = async (data: ProfileFormValues) => {
    const submissionData = {
      ...data,
      stylePreferences: selectedStyles,
      measurementSystem
    }
    await onSubmit(submissionData)
  }
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Progress Header */}
      <Card className="glass-panel">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Complete Your Profile</CardTitle>
              <CardDescription>
                Help us create the most accurate virtual try-on experience for you
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{completionPercentage}%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
          </div>
          <Progress value={completionPercentage} className="mt-4" />
        </CardHeader>
      </Card>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          
          {/* Height Section */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-lg">Height</CardTitle>
              <CardDescription>
                Accurate height ensures proper garment proportions and fit
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Measurement System Toggle */}
              <div className="flex items-center justify-center space-x-2 mb-6">
                <Button
                  type="button"
                  variant={measurementSystem === 'imperial' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleMeasurementSystemChange('imperial')}
                  className="px-6"
                >
                  ft/in
                </Button>
                <Button
                  type="button"
                  variant={measurementSystem === 'metric' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleMeasurementSystemChange('metric')}
                  className="px-6"
                >
                  cm
                </Button>
              </div>
              
              {measurementSystem === 'imperial' ? (
                <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="heightFeet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feet</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select feet" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="4">4 ft</SelectItem>
                          <SelectItem value="5">5 ft</SelectItem>
                          <SelectItem value="6">6 ft</SelectItem>
                          <SelectItem value="7">7 ft</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="heightInches"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inches</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select inches" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i} in
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              ) : (
                <FormField
                  control={form.control}
                  name="heightCentimeters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (centimeters)</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select height in cm" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {Array.from({ length: 101 }, (_, i) => {
                            const cm = 120 + i;
                            const feet = Math.floor(cm / 30.48);
                            const inches = Math.round((cm % 30.48) / 2.54);
                            return (
                              <SelectItem key={cm} value={cm.toString()}>
                                {cm} cm ({feet}'{inches}")
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Height in centimeters (120-220 cm)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
          
          {/* Demographics Section */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>
                This helps us provide age-appropriate and inclusive recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="ageRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age Range</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select age range" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="18-25">18-25 years</SelectItem>
                        <SelectItem value="26-35">26-35 years</SelectItem>
                        <SelectItem value="36-45">36-45 years</SelectItem>
                        <SelectItem value="46-55">46-55 years</SelectItem>
                        <SelectItem value="55+">55+ years</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender Identity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender identity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non-binary">Non-binary</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Used for appropriate fit recommendations and sizing
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="ethnicity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ethnicity (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Asian, Black, Latino, Middle Eastern, White, Mixed, etc."
                        className="bg-background/50"
                      />
                    </FormControl>
                    <FormDescription>
                      Helps with skin tone matching and cultural style preferences
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          {/* Body Type Section */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-lg">Body Type</CardTitle>
              <CardDescription>
                Choose the body type that best represents your build for accurate fitting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="bodyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body Build</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select body type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="slim">Slim - Lean build with narrow frame</SelectItem>
                        <SelectItem value="average">Average - Balanced proportions</SelectItem>
                        <SelectItem value="athletic">Athletic - Muscular and toned</SelectItem>
                        <SelectItem value="plus-size">Plus Size - Fuller figure</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          {/* Style Preferences Section */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-lg">Style Preferences (Optional)</CardTitle>
              <CardDescription>
                Select styles you enjoy wearing. This helps personalize recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {STYLE_OPTIONS.map((style) => (
                  <Button
                    key={style}
                    type="button"
                    variant={selectedStyles.includes(style) ? "default" : "outline"}
                    size="sm"
                    className="justify-start h-auto py-3"
                    onClick={() => handleStyleToggle(style)}
                  >
                    {selectedStyles.includes(style) && (
                      <CheckIcon className="w-4 h-4 mr-2" />
                    )}
                    <span className="capitalize">{style}</span>
                  </Button>
                ))}
              </div>
              {selectedStyles.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Selected styles:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedStyles.map((style) => (
                      <Badge key={style} variant="secondary" className="capitalize">
                        {style}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Benefits Preview */}
          <Card className="glass-panel border-primary/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <StarIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="font-semibold">85% More Accurate</div>
                  <div className="text-sm text-muted-foreground">Better fit visualization</div>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="font-semibold">Save 15 Credits</div>
                  <div className="text-sm text-muted-foreground">Fewer retries needed</div>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <StarIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="font-semibold">Personalized</div>
                  <div className="text-sm text-muted-foreground">Custom recommendations</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="submit"
              disabled={isLoading || completionPercentage < 80}
              className="min-w-[150px]"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : (
                `Save Profile ${completionPercentage >= 80 ? '& Get 5 Bonus Credits!' : ''}`
              )}
            </Button>
          </div>
          
          {completionPercentage < 80 && (
            <p className="text-sm text-muted-foreground text-center">
              Complete at least 80% of your profile to save and earn bonus credits
            </p>
          )}
          
        </form>
      </Form>
    </div>
  )
}