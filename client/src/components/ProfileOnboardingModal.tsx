"use client"

import { useState } from "react"
import { useLocation } from "wouter"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UserProfileForm } from "./UserProfileForm"
import { ProfileBenefitsShowcase } from "./ProfileBenefitsShowcase"
import { StarIcon, ArrowRightIcon, SkipForwardIcon } from "lucide-react"

interface ProfileOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (profileData: any) => Promise<void>
  userEmail?: string
}

export function ProfileOnboardingModal({ 
  isOpen, 
  onClose, 
  onComplete,
  userEmail 
}: ProfileOnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState<'benefits' | 'form'>('benefits')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, navigate] = useLocation()
  
  const handleContinueToForm = () => {
    setCurrentStep('form')
  }
  
  const handleSkipForNow = () => {
    onClose()
    navigate('/dashboard')
  }
  
  const handleFormSubmit = async (profileData: any) => {
    setIsSubmitting(true)
    try {
      await onComplete(profileData)
      onClose()
      navigate('/dashboard?profileCompleted=true')
    } catch (error) {
      console.error('Profile submission failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        {currentStep === 'benefits' ? (
          <>
            <DialogHeader className="p-6 pb-4">
              <DialogTitle className="text-2xl font-bold text-center">
                Welcome to GarmaxAi! 🎉
              </DialogTitle>
              <DialogDescription className="text-center text-lg">
                Let's set up your profile for the most accurate virtual try-on experience
              </DialogDescription>
            </DialogHeader>
            
            <div className="px-6 pb-6">
              <ProfileBenefitsShowcase />
              
              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={handleContinueToForm}
                  size="lg"
                  className="flex items-center space-x-2"
                >
                  <StarIcon className="w-5 h-5" />
                  <span>Complete My Profile & Get 5 Bonus Credits</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleSkipForNow}
                  size="lg"
                  className="flex items-center space-x-2"
                >
                  <SkipForwardIcon className="w-4 h-4" />
                  <span>Skip for Now</span>
                </Button>
              </div>
              
              <p className="text-center text-sm text-muted-foreground mt-4">
                You can always complete your profile later in your account settings
              </p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold">
                    Complete Your Profile
                  </DialogTitle>
                  <DialogDescription>
                    Help us create the perfect virtual try-on experience for you
                  </DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep('benefits')}
                  className="text-muted-foreground"
                >
                  ← Back to Benefits
                </Button>
              </div>
            </DialogHeader>
            
            <div className="px-6 pb-6">
              <UserProfileForm
                onSubmit={handleFormSubmit}
                isLoading={isSubmitting}
              />
              
              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  onClick={handleSkipForNow}
                  disabled={isSubmitting}
                >
                  Skip for Now
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}