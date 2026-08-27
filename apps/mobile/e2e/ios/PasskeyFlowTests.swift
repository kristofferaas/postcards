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

  private func signOut(_ app: XCUIApplication, timeout: TimeInterval) -> Bool {
    let settings = app.buttons["Settings"]
    guard waitUntilHittable(settings, timeout: timeout) else {
      return false
    }
    settings.tap()

    let signOut = app.descendants(matching: .any)["Sign out"]
    guard waitUntilHittable(signOut, timeout: 5) else {
      return false
    }
    signOut.tap()
    return true
  }

  func testPasskeyContinuesToRegistrationOrSignIn() throws {
    let app = XCUIApplication()
    app.launch()

    let continueWithPasskey = app.buttons["Continue with passkey"]
    if !continueWithPasskey.waitForExistence(timeout: 3) {
      let developmentServer = app.buttons.matching(
        NSPredicate(format: "label BEGINSWITH 'Post Cards, http'")
      ).firstMatch
      if developmentServer.waitForExistence(timeout: 3) {
        developmentServer.tap()
      }
    }

    let developerMenuContinue = app.buttons["Continue"]
    if waitUntilHittable(developerMenuContinue, timeout: 10) {
      developerMenuContinue.tap()
    }

    let closeDeveloperMenu = app.buttons["Close"]
    if waitUntilHittable(closeDeveloperMenu, timeout: 10) {
      closeDeveloperMenu.tap()
    }

    _ = signOut(app, timeout: 3)

    XCTAssertTrue(
      waitUntilHittable(continueWithPasskey, timeout: 15),
      "Expected the auth screen. App hierarchy:\n\(app.debugDescription)"
    )
    XCTAssertFalse(app.textFields["Your name"].exists)
    continueWithPasskey.tap()

    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let signInCancel = springboard.descendants(matching: .any)[
      "ASAuthorizationControllerCancelButton"
    ]
    if waitUntilHittable(signInCancel, timeout: 5) {
      signInCancel.tap()
    }

    let name = app.textFields["Your name"]
    XCTAssertTrue(
      waitUntilHittable(name, timeout: 15),
      "Expected account creation to be offered after passkey dismissal. App hierarchy:\n" +
        app.debugDescription
    )
    XCTAssertTrue(app.buttons["Try passkey again"].exists)
    name.tap()
    name.typeText("A")
    let createAccount = app.buttons["Create account"]
    XCTAssertTrue(waitUntilHittable(createAccount, timeout: 5))
    createAccount.tap()

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

    XCTAssertTrue(
      signOut(app, timeout: 60),
      "Expected registration to establish a session. App hierarchy:\n" +
        app.debugDescription
    )

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

    let settings = app.buttons["Settings"]
    XCTAssertTrue(
      waitUntilHittable(settings, timeout: 60),
      "Expected passkey sign-in to restore the session. App hierarchy:\n" +
        app.debugDescription
    )
    settings.tap()

    let signOut = app.descendants(matching: .any)["Sign out"]
    XCTAssertTrue(waitUntilHittable(signOut, timeout: 5))

    let profile = app.descendants(matching: .any).matching(
      NSPredicate(format: "label == 'Signed in as A'")
    ).firstMatch
    XCTAssertTrue(profile.waitForExistence(timeout: 5))

    app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75))
      .press(
        forDuration: 0.1,
        thenDragTo: app.coordinate(
          withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98)
        )
      )
    let drawerDismissed = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "exists == false"),
      object: signOut
    )
    XCTAssertEqual(
      XCTWaiter.wait(for: [drawerDismissed], timeout: 5),
      .completed
    )
  }
}
