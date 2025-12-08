"use client"

import { useState, useEffect } from "react"
import { useUserProfile, FrontendUnitConverter } from "../hooks/useUserProfile"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { UserProfileForm } from "./UserProfileForm"
import { ProfileBenefitsShowcase } from "./ProfileBenefitsShowcase"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UserIcon, EditIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from "lucide-react"

interface ProfileEditSectionProps {
  className?: string
}

interface UserProfileState {
  heightFeet?: number
  heightInches?: number
  ageRange?: string
  gender?: string
  bodyType?: string
  ethnicity?: string
  stylePreferences?: string[]
  profileCompleted?: boolean
  profileCompletedAt?: Date
  completionPercentage: number
}

export function ProfileEditSection({ className = "" }: ProfileEditSectionProps) {
  const { profile, loading, error, updateProfile, trackAbandonment } = useUserProfile()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isBenefitsModalOpen, setIsBenefitsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const handleProfileUpdate = async (newProfileData: any) => {
    setIsLoading(true)
    try {
      await updateProfile(newProfileData)
      setIsEditModalOpen(false)
    } catch (error) {
      console.error('Profile update failed:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleModalClose = async () => {
    // Track abandonment if profile is incomplete
    if (profile && !profile.profileCompleted) {
      await trackAbandonment('profile_edit_modal')
    }
    setIsEditModalOpen(false)
  }
  
  const getCompletionPercentage = () => {
    if (!profile) return 0
    
    const totalFields = 6 // height, age, gender, body type, ethnicity, style preferences
    let completedFields = 0
    
    // Check height (either imperial or metric)
    if (FrontendUnitConverter.validateHeight(
      profile.heightFeet, 
      profile.heightInches, 
      profile.heightCentimeters, 
      profile.measurementSystem || 'imperial'
    )) {
      completedFields++
    }
    
    if (profile.ageRange) completedFields++
    if (profile.gender) completedFields++
    if (profile.bodyType) completedFields++
    if (profile.ethnicity && profile.ethnicity.trim().length >= 2) completedFields++
    if (profile.stylePreferences && profile.stylePreferences.length > 0) completedFields++
    
    return Math.round((completedFields / totalFields) * 100)
  }
  
  const getCompletionStatus = () => {
    const completionPercentage = getCompletionPercentage()
    
    if (completionPercentage >= 80) {
      return {
        icon: CheckCircleIcon,
        color: 'text-green-400',
        bgColor: 'bg-green-400/10',
        borderColor: 'border-green-400/20',
        text: 'Complete',
        description: 'Your profile is complete and optimized for accurate try-ons'
      }
    } else if (profile.completionPercentage >= 50) {
      return {
        icon: AlertCircleIcon,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-400/10',
        borderColor: 'border-yellow-400/20',
        text: 'Partially Complete',
        description: 'Complete your profile for better try-on accuracy'
      }
    } else {
      return {
        icon: AlertCircleIcon,
        color: 'text-red-400',
        bgColor: 'bg-red-400/10',
        borderColor: 'border-red-400/20',
        text: 'Incomplete',
        description: 'Please complete your profile to get accurate try-ons'
      }
    }
  }
  
  const status = getCompletionStatus()
  const StatusIcon = status.icon
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Profile Completion Card */}
      <Card className={`border-white/10 bg-card ${status.borderColor}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserIcon className="w-6 h-6 text-accent" />
              <div>
                <CardTitle>Physical Profile</CardTitle>
                <CardDescription>
                  Your personal measurements and preferences for accurate try-ons
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant="secondary" 
                className={`${status.bgColor} ${status.color} border-none`}
              >
                <StatusIcon className="w-4 h-4 mr-1" />
                {status.text}
              </Badge>
              <Dialog open={isEditModalOpen} onOpenChange={(open) => open ? setIsEditModalOpen(true) : handleModalClose()}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <EditIcon className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Your Profile</DialogTitle>
                    <DialogDescription>
                      Update your physical profile for more accurate virtual try-ons
                    </DialogDescription>
                  </DialogHeader>
                  <UserProfileForm
                    initialData={profile}
                    onSubmit={handleProfileUpdate}
                    isLoading={isLoading}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Completion Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Profile Completion</span>
              <span className="text-sm font-bold">{getCompletionPercentage()}%</span>
            </div>
            <Progress value={getCompletionPercentage()} className="h-2" />
            <p className="text-xs text-muted-foreground">{status.description}</p>
          </div>
          
          {/* Profile Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-muted-foreground mb-1">Height</p>
                <p className="font-medium">
                  {FrontendUnitConverter.formatHeight(
                    profile.heightFeet, 
                    profile.heightInches, 
                    profile.heightCentimeters, 
                    profile.measurementSystem || 'imperial'
                  )}
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-muted-foreground mb-1">Age Range</p>
                <p className="font-medium">{profile.ageRange || 'Not set'}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-muted-foreground mb-1">Gender</p>
                <p className="font-medium capitalize">{profile.gender?.replace('-', ' ') || 'Not set'}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-muted-foreground mb-1">Body Type</p>
                <p className="font-medium capitalize">{profile.bodyType?.replace('-', ' ') || 'Not set'}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-muted-foreground mb-1">Ethnicity</p>
                <p className="font-medium">{profile.ethnicity || 'Not specified'}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-muted-foreground mb-1">Style Preferences</p>
                <div className="flex flex-wrap gap-1">
                  {profile.stylePreferences && profile.stylePreferences.length > 0 ? (
                    profile.stylePreferences.map((style: string) => (
                      <Badge key={style} variant="secondary" className="capitalize">
                        {style}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">None selected</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Profile Benefits */}
          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <InfoIcon className="w-4 h-4 text-primary" />
                <span className="font-medium text-primary">Profile Benefits</span>
              </div>
              <Dialog open={isBenefitsModalOpen} onOpenChange={setIsBenefitsModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-primary">
                    Learn More
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Profile Completion Benefits</DialogTitle>
                    <DialogDescription>
                      See how completing your profile dramatically improves try-on accuracy
                    </DialogDescription>
                  </DialogHeader>
                  <ProfileBenefitsShowcase />
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-primary">85%</div>
                <div className="text-muted-foreground">More Accurate</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-primary">15</div>
                <div className="text-muted-foreground">Credits Saved</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-primary">3x</div>
                <div className="text-muted-foreground">Faster Results</div>
              </div>
            </div>
          </div>
          
          {profile.profileCompleted && profile.profileCompletedAt && (
            <div className="text-xs text-muted-foreground">
              Profile completed on {profile.profileCompletedAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}