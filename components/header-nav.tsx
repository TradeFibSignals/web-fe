"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, BarChart2, LineChart, Calendar, Archive, ChevronDown, BarChart, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function HeaderNav() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Handle scroll event to apply shrinking/blur effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-200",
        isScrolled ? "bg-background/80 backdrop-blur-md border-b py-2" : "bg-background py-4",
      )}
    >
      <div className="container mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">BTC Market Today</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1">
            <BarChart2 className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          {/* Analysis Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-1 p-0">
                <BarChart className="h-4 w-4" />
                <span className="text-sm font-medium">Analysis</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/cme-gap" className="flex items-center gap-2">
                  <LineChart className="h-4 w-4" />
                  <span>CME Gap</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/seasonality" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Seasonality</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href="/archive"
            className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
          >
            <Archive className="h-4 w-4" />
            <span>News Archive</span>
          </Link>
          <Link
            href="/calculator"
            className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
          >
            <Calculator className="h-4 w-4" />
            <span>Calculator</span>
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[80vw] sm:w-[350px]">
              <div className="flex flex-col gap-6 mt-6">
                {/* Mobile Navigation Links */}
                <nav className="flex flex-col gap-4">
                  <Link href="/" className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors">
                    <BarChart2 className="h-5 w-5" />
                    <span className="font-medium">Dashboard</span>
                  </Link>

                  {/* Analysis Section in Mobile */}
                  <div className="px-2 py-1 text-sm text-muted-foreground">Analysis</div>

                  <Link
                    href="/cme-gap"
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors pl-4"
                  >
                    <LineChart className="h-5 w-5" />
                    <span className="font-medium">CME Gap</span>
                  </Link>

                  <Link
                    href="/seasonality"
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors pl-4"
                  >
                    <Calendar className="h-5 w-5" />
                    <span className="font-medium">Seasonality</span>
                  </Link>

                  <Link
                    href="/archive"
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors"
                  >
                    <Archive className="h-5 w-5" />
                    <span className="font-medium">News Archive</span>
                  </Link>
                  <Link
                    href="/calculator"
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors"
                  >
                    <Calculator className="h-5 w-5" />
                    <span className="font-medium">Calculator</span>
                  </Link>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
