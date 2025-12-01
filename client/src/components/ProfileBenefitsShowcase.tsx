"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckIcon, XIcon, StarIcon, TrendingUpIcon } from "lucide-react"

interface ProfileBenefitsShowcaseProps {
  className?: string
}

export function ProfileBenefitsShowcase({ className = "" }: ProfileBenefitsShowcaseProps) {
  return (
    <div className={`space-y-8 ${className}`}>
      
      {/* Header with Stats */}
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold">See the Difference Profile Completion Makes</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Users with complete profiles get 85% more accurate try-ons and save an average of 15 credits
        </p>
        
        <div className="flex justify-center space-x-8 mt-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">85%</div>
            <div className="text-sm text-muted-foreground">More Accurate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">15</div>
            <div className="text-sm text-muted-foreground">Credits Saved</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">3x</div>
            <div className="text-sm text-muted-foreground">Faster Results</div>
          </div>
        </div>
      </div>
      
      {/* Before/After Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Without Profile Section */}
        <Card className="glass-panel border-destructive/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <XIcon className="w-5 h-5 text-destructive" />
              <h3 className="text-xl font-semibold text-destructive">Without Complete Profile</h3>
            </div>
            
            {/* Example 1 - Generic Asian Woman */}
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="aspect-[3/4] bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg mb-3 flex items-center justify-center">
                  <div className="text-center text-slate-600">
                    <div className="text-sm font-medium">Generic Result</div>
                    <div className="text-xs">Asian Woman, ~30s</div>
                    <div className="text-xs">Average height/build</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="destructive">Poor fit</Badge>
                  <Badge variant="destructive">Wrong proportions</Badge>
                  <Badge variant="destructive">Generic sizing</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  AI guesses: "Asian woman in her 30s" - shirt appears too loose, proportions don't match actual height of 5'2"
                </p>
              </div>
              
              {/* Example 2 - Generic Black Man */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="aspect-[3/4] bg-gradient-to-br from-amber-200 to-amber-300 rounded-lg mb-3 flex items-center justify-center">
                  <div className="text-center text-amber-800">
                    <div className="text-sm font-medium">Generic Result</div>
                    <div className="text-xs">Black Man, ~40s</div>
                    <div className="text-xs">Average height/build</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="destructive">Inaccurate fit</Badge>
                  <Badge variant="destructive">Wrong skin tone</Badge>
                  <Badge variant="destructive">Poor matching</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  AI guesses: "Black man, average build" - jacket doesn't fit athletic 6'1" frame, skin tone mismatch
                </p>
              </div>
              
              {/* Example 3 - Generic Latina Woman */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="aspect-[3/4] bg-gradient-to-br from-pink-200 to-pink-300 rounded-lg mb-3 flex items-center justify-center">
                  <div className="text-center text-pink-800">
                    <div className="text-sm font-medium">Generic Result</div>
                    <div className="text-xs">Latina Woman, ~25</div>
                    <div className="text-xs">Average height/build</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="destructive">Size mismatch</Badge>
                  <Badge variant="destructive">Wrong age styling</Badge>
                  <Badge variant="destructive">Generic look</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  AI guesses: "Latina woman, mid-20s" - dress sizing wrong for plus-size figure, no style personalization
                </p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-destructive/5 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUpIcon className="w-4 h-4 text-destructive" />
                <span className="font-medium text-destructive">Typical Issues</span>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• AI makes incorrect age/height/build assumptions</li>
                <li>• Generic "average" sizing doesn't fit actual body</li>
                <li>• Multiple retry attempts waste credits</li>
                <li>• No style personalization or preferences</li>
                <li>• Poor skin tone and feature matching</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        {/* With Complete Profile Section */}
        <Card className="glass-panel border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <CheckIcon className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-semibold text-primary">With Complete Profile</h3>
            </div>
            
            {/* Example 1 - Personalized Asian Woman */}
            <div className="space-y-4">
              <div className="bg-primary/5 rounded-lg p-4">
                <div className="aspect-[3/4] bg-gradient-to-br from-emerald-200 to-emerald-300 rounded-lg mb-3 flex items-center justify-center">
                  <div className="text-center text-emerald-800">
                    <div className="text-sm font-medium">Perfect Match</div>
                    <div className="text-xs">Korean, 28, 5'2"</div>
                    <div className="text-xs">Slim, Minimalist Style</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="default">Perfect fit</Badge>
                  <Badge variant="default">Accurate proportions</Badge>
                  <Badge variant="default">Style match</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Profile data: Korean, 28, 5'2", slim build, minimalist style - shirt fits perfectly with proper proportions
                </p>
              </div>
              
              {/* Example 2 - Personalized Black Man */}
              <div className="bg-primary/5 rounded-lg p-4">
                <div className="aspect-[3/4] bg-gradient-to-br from-blue-200 to-blue-300 rounded-lg mb-3 flex items-center justify-center">
                  <div className="text-center text-blue-800">
                    <div className="text-sm font-medium">Perfect Match</div>
                    <div className="text-xs">Nigerian, 35, 6'1"</div>
                    <div className="text-xs">Athletic, Formal Style</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="default">Athletic fit</Badge>
                  <Badge variant="default">Proper length</Badge>
                  <Badge variant="default">Style preference</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Profile data: Nigerian, 35, 6'1", athletic build, formal style - jacket tailored for broad shoulders and height
                </p>
              </div>
              
              {/* Example 3 - Personalized Latina Woman */}
              <div className="bg-primary/5 rounded-lg p-4">
                <div className="aspect-[3/4] bg-gradient-to-br from-purple-200 to-purple-300 rounded-lg mb-3 flex items-center justify-center">
                  <div className="text-center text-purple-800">
                    <div className="text-sm font-medium">Perfect Match</div>
                    <div className="text-xs">Mexican, 42, 5'4"</div>
                    <div className="text-xs">Plus-size, Bohemian</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="default">Flattering cut</Badge>
                  <Badge variant="default">Age appropriate</Badge>
                  <Badge variant="default">Style aligned</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Profile data: Mexican, 42, 5'4", plus-size, bohemian style - dress fits curves beautifully with age-appropriate styling
                </p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-primary/5 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <StarIcon className="w-4 h-4 text-primary" />
                <span className="font-medium text-primary">Profile Benefits</span>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Precise age, height, and build specifications</li>
                <li>• Culturally-aware styling and skin tone matching</li>
                <li>• Style preferences integrated into recommendations</li>
                <li>• Body-positive sizing for all figures</li>
                <li>• First-try accuracy saves time and credits</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Diversity Representation Grid */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold text-center mb-6">Works Beautifully for Everyone</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          
          {/* Diverse examples */}
          {[
            { ethnicity: "East Asian", age: "22", build: "Slim", style: "K-pop" },
            { ethnicity: "Nigerian", age: "28", build: "Athletic", style: "Afrocentric" },
            { ethnicity: "Mexican", age: "35", build: "Curvy", style: "Bohemian" },
            { ethnicity: "Nordic", age: "45", build: "Average", style: "Minimalist" },
            { ethnicity: "Indian", age: "32", build: "Petite", style: "Traditional" },
            { ethnicity: "Middle Eastern", age: "29", build: "Plus-size", style: "Modest" },
          ].map((person, index) => (
            <Card key={index} className="glass-panel">
              <CardContent className="p-3">
                <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/30 rounded-lg mb-2 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xs font-medium">{person.ethnicity}</div>
                    <div className="text-xs opacity-75">{person.age}y, {person.build}</div>
                  </div>
                </div>
                <div className="text-xs text-center">
                  <Badge variant="outline">{person.style}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <p className="text-center text-muted-foreground mt-4 text-sm">
          Our AI understands and celebrates diversity - providing accurate, respectful, and beautiful results for people of all backgrounds, ages, and body types.
        </p>
      </div>
      
      {/* Call to Action */}
      <Card className="glass-panel border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">Ready for Your Perfect Fit?</h3>
          <p className="text-lg text-muted-foreground mb-6">
            Complete your profile in under 2 minutes and start getting 85% more accurate try-ons immediately
          </p>
          <div className="flex justify-center space-x-6">
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-5 h-5 text-primary" />
              <span>5 bonus credits</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-5 h-5 text-primary" />
              <span>Instant improvements</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-5 h-5 text-primary" />
              <span>Personalized results</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}