import XCTest

final class PasskeyFlowTests: XCTestCase {
  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  private func waitUntilHittable(
    _ element: XCUIElement,
    timeout: TimeInterval
  ) -> Bool {
    let predicate = NSPredicate(
      format: "exists == true AND hittable == true"
    )
    let expectation = XCTNSPredicateExpectation(
      predicate: predicate,
      object: element
    )
    return XCTWaiter.wait(
      for: [expectation],
      timeout: timeout
    ) == .completed
  }

  func testPasskeyRegistrationAndSignInAreOffered() throws {
    let app = XCUIApplication()
    app.launch()

    let signUp = app.descendants(matching: .any)["Sign up"]
    if !signUp.waitForExistence(timeout: 3) {
      let developmentServer = app.buttons.matching(
        NSPredicate(format: "label BEGINSWITH 'Post Cards, http'")
      ).firstMatch
      if developmentServer.waitForExistence(timeout: 3) {
        developmentServer.tap()
      }
    }

    let developerMenuContinue = app.buttons["Continue"]
    if waitUntilHittable(developerMenuContinue, timeout: 3) {
      developerMenuContinue.tap()
    }

    let closeDeveloperMenu = app.buttons["Close"]
    if waitUntilHittable(closeDeveloperMenu, timeout: 3) {
      closeDeveloperMenu.tap()
    }

    let existingSignOut = app.buttons["Sign out"]
    if waitUntilHittable(existingSignOut, timeout: 3) {
      existingSignOut.tap()
    }

    XCTAssertTrue(
      waitUntilHittable(signUp, timeout: 15),
      "Expected the auth screen. App hierarchy:\n\(app.debugDescription)"
    )
    signUp.tap()

    let name = app.textFields["Your name"]
    XCTAssertTrue(waitUntilHittable(name, timeout: 5))
    name.tap()
    name.typeText("A")
    let createPasskey = app.buttons["Create passkey"]
    XCTAssertTrue(waitUntilHittable(createPasskey, timeout: 5))
    createPasskey.tap()

    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let passkeySheet = springboard.staticTexts.matching(
      NSPredicate(format: "label CONTAINS[c] 'passkey'")
    ).firstMatch
    XCTAssertTrue(
      passkeySheet.waitForExistence(timeout: 15),
      "Expected iOS to present its native passkey registration sheet. " +
        "SpringBoard hierarchy:\n\(springboard.debugDescription)\n" +
        "App hierarchy:\n\(app.debugDescription)"
    )

    let registrationContinue = springboard.descendants(matching: .any)[
      "ASAuthorizationControllerContinueButton"
    ]
    XCTAssertTrue(
      waitUntilHittable(registrationContinue, timeout: 5),
      "Expected a registration confirmation. SpringBoard hierarchy:\n" +
        springboard.debugDescription
    )
    registrationContinue.tap()

    let signOut = app.buttons["Sign out"]
    XCTAssertTrue(
      waitUntilHittable(signOut, timeout: 60),
      "Expected registration to establish a session. App hierarchy:\n" +
        app.debugDescription
    )
    signOut.tap()

    let signIn = app.buttons["Continue with passkey"]
    XCTAssertTrue(waitUntilHittable(signIn, timeout: 15))
    signIn.tap()

    let signInContinue = springboard.descendants(matching: .any)[
      "ASAuthorizationControllerContinueButton"
    ]
    XCTAssertTrue(
      waitUntilHittable(signInContinue, timeout: 15),
      "Expected a passkey sign-in confirmation. SpringBoard hierarchy:\n" +
        springboard.debugDescription
    )
    signInContinue.tap()

    XCTAssertTrue(
      waitUntilHittable(app.buttons["Sign out"], timeout: 60),
      "Expected passkey sign-in to restore the session. App hierarchy:\n" +
        app.debugDescription
    )
  }
}
