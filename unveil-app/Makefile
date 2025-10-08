# Unveil iOS Development Makefile
# Usage: make <target>

.PHONY: ios-verify ios-run-dev ios-archive ios-open ios-clean ios-ruby-check help

# iOS verification and repair with speedup optimizations
ios-verify:
	@echo "🔍 Running iOS verification and repair..."
	@bash ./scripts/ios-verify-repair.sh

# Run iOS app in development mode
ios-run-dev:
	@echo "🔧 Running iOS app in development mode..."
	@export CAP_SERVER_URL=http://localhost:3000 && \
	 npx cap copy ios && \
	 echo "✅ Development mode configured. Open Xcode and select 'Unveil (Dev)' scheme." && \
	 open ios/App/App.xcworkspace

# Open iOS project in Xcode
ios-open:
	@echo "📱 Opening iOS project in Xcode..."
	@npx cap open ios

# Clean iOS build artifacts
ios-clean:
	@echo "🧹 Cleaning iOS build artifacts..."
	@rm -rf ios/App/build/
	@rm -rf ios/App/DerivedData/
	@rm -rf _artifacts/ios_builds/build_*.log
	@echo "✅ iOS build artifacts cleaned"

# Test iOS build without CocoaPods (for Ruby version issues)
ios-build-without-pods:
	@echo "🧪 Testing iOS build without CocoaPods..."
	@bash ./scripts/ios-build-no-pods.sh

# Check Ruby version and provide upgrade guidance
ios-ruby-check:
	@echo "💎 Checking Ruby version for CocoaPods compatibility..."
	@ruby --version
	@echo ""
	@echo "CocoaPods requires Ruby 3.1.0+. Current solutions:"
	@echo "  1. Install modern Ruby: brew install ruby"
	@echo "  2. Use rbenv: brew install rbenv && rbenv install 3.1.0"
	@echo "  3. Test without CocoaPods: make ios-build-without-pods"

# Create iOS archive for TestFlight/App Store
ios-archive:
	@echo "📦 Creating iOS archive for TestFlight..."
	@export CAP_SERVER_URL=https://app.sendunveil.com && \
	 bash ./scripts/ios-archive.sh

# Show available targets
help:
	@echo "Available iOS targets:"
	@echo "  ios-verify           - Verify and repair iOS setup with Unveil (Dev) scheme"
	@echo "  ios-run-dev          - Configure and run iOS app in development mode"
	@echo "  ios-archive          - Create iOS archive for TestFlight/App Store with Unveil (Prod) scheme"
	@echo "  ios-open             - Open iOS project in Xcode"
	@echo "  ios-clean            - Clean iOS build artifacts"
	@echo "  ios-ruby-check       - Check Ruby version compatibility"
	@echo "  help                 - Show this help message"
