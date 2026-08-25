begin
  require "xcodeproj"
rescue LoadError
  pod_path = `command -v pod`.strip
  pod_wrapper = File.exist?(pod_path) ? File.read(pod_path) : ""
  cocoa_pods_gem_home = pod_wrapper[/GEM_HOME="([^"]+)"/, 1]

  unless cocoa_pods_gem_home
    raise <<~MESSAGE
      The xcodeproj gem is unavailable. Install CocoaPods, then run this command again.
    MESSAGE
  end

  Gem.use_paths(
    cocoa_pods_gem_home,
    [cocoa_pods_gem_home, *Gem.path]
  )
  require "xcodeproj"
end

mobile_dir = File.expand_path("..", __dir__)
project_path = File.join(mobile_dir, "ios", "PostCards.xcodeproj")

raise "Run expo prebuild for iOS first." unless File.exist?(project_path)

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |target| target.name == "PostCards" }
raise "PostCards target not found" unless app_target

test_target = project.targets.find do |target|
  target.name == "PostCardsUITests"
end

group = project.main_group.children.find do |child|
  child.respond_to?(:name) && child.name == "PostCardsUITests"
end
group ||= project.main_group.new_group(
  "PostCardsUITests",
  File.join("..", "e2e", "ios")
)
group.path = File.join("..", "e2e", "ios")
group.source_tree = "<group>"

unless test_target
  test_target = project.new_target(
    :ui_test_bundle,
    "PostCardsUITests",
    :ios,
    "16.4"
  )
  test_target.add_dependency(app_target)
end

source = group.files.find do |file|
  file.path == "PasskeyFlowTests.swift"
end
source ||= group.new_file("PasskeyFlowTests.swift")

unless test_target.source_build_phase.files_references.include?(source)
  test_target.source_build_phase.add_file_reference(source)
end

test_target.build_configurations.each do |configuration|
  configuration.build_settings["GENERATE_INFOPLIST_FILE"] = "YES"
  configuration.build_settings["PRODUCT_BUNDLE_IDENTIFIER"] =
    "com.kristofferaas.postcards.uitests"
  configuration.build_settings["PRODUCT_MODULE_NAME"] = "PostCardsUITests"
  configuration.build_settings["PRODUCT_NAME"] = "$(TARGET_NAME)"
  configuration.build_settings["SWIFT_VERSION"] = "5.0"
  configuration.build_settings["TARGETED_DEVICE_FAMILY"] = "1,2"
  configuration.build_settings["TEST_TARGET_NAME"] = "PostCards"
end

project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app_target)
scheme.add_build_target(test_target)
scheme.add_test_target(test_target)
scheme.save_as(project_path, "PostCardsPasskeyUITests", true)
