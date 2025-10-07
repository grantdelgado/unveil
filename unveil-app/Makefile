# Unveil iOS Development Makefile
# Usage: make <target>

.PHONY: ios-verify ios-open ios-clean ios-build-without-pods ios-ruby-check help

# iOS verification and repair
ios-verify:
	@echo "🔍 Running iOS verification and repair..."
	@bash ./scripts/ios-verify-repair.sh

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

# Show available targets
help:
	@echo "Available iOS targets:"
	@echo "  ios-verify           - Verify and repair iOS setup"
	@echo "  ios-open             - Open iOS project in Xcode"
	@echo "  ios-clean            - Clean iOS build artifacts"
	@echo "  ios-build-without-pods - Test build without CocoaPods"
	@echo "  ios-ruby-check       - Check Ruby version compatibility"
	@echo "  help                 - Show this help message"
