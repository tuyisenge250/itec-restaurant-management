'use client'

import { Button } from '@/components/ui/button'

export function SeeHowButton() {
  return (
    <Button variant="outline" size="lg" onClick={() => console.log('see how it works')}>
      See how it works
    </Button>
  )
}
