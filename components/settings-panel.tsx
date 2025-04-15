"use client"

import { useLiquidation } from "@/context/liquidation-context"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"

export function SettingsPanel() {
  const {
    showLongLiquidations,
    setShowLongLiquidations,
    showShortLiquidations,
    setShowShortLiquidations,
    signalSensitivity,
    setSignalSensitivity,
    colorScheme,
    setColorScheme,
    notificationsEnabled,
    setNotificationsEnabled,
  } = useLiquidation()

  return (
    <div className="py-4 space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Display Options</h3>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-long-liquidations" className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            Show Long Liquidations
          </Label>
          <Switch
            id="show-long-liquidations"
            checked={showLongLiquidations}
            onCheckedChange={setShowLongLiquidations}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-short-liquidations" className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success" />
            Show Short Liquidations
          </Label>
          <Switch
            id="show-short-liquidations"
            checked={showShortLiquidations}
            onCheckedChange={setShowShortLiquidations}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Signal Settings</h3>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="signal-sensitivity">Signal Sensitivity</Label>
            <span className="text-sm">{signalSensitivity}%</span>
          </div>
          <Slider
            id="signal-sensitivity"
            min={0}
            max={100}
            step={5}
            value={[signalSensitivity]}
            onValueChange={(value) => setSignalSensitivity(value[0])}
          />
          <p className="text-xs text-muted-foreground">
            Higher sensitivity will generate more signals but may include false positives
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Appearance</h3>

        <RadioGroup
          value={colorScheme}
          onValueChange={(value) => setColorScheme(value as "default" | "colorblind" | "monochrome")}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="default" id="color-default" />
            <Label htmlFor="color-default">Default</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="colorblind" id="color-colorblind" />
            <Label htmlFor="color-colorblind">Colorblind Friendly</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="monochrome" id="color-monochrome" />
            <Label htmlFor="color-monochrome">Monochrome</Label>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Notifications</h3>

        <div className="flex items-center justify-between">
          <Label htmlFor="enable-notifications">Enable Notifications</Label>
          <Switch id="enable-notifications" checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
        </div>

        <p className="text-xs text-muted-foreground">Receive alerts when price approaches major liquidation zones</p>
      </div>
    </div>
  )
}
