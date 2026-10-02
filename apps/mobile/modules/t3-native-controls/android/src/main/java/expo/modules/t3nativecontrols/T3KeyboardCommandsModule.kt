package expo.modules.t3nativecontrols

import android.content.Context
import android.view.KeyEvent
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class T3KeyboardCommandsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("T3KeyboardCommands")

    View(T3KeyboardCommandsView::class) {
      Prop("enabledCommands") { view: T3KeyboardCommandsView, commands: List<String> ->
        view.enabledCommands = commands.toSet()
      }
      Events("onCommand")
    }
  }
}

class T3KeyboardCommandsView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  private val onCommand by EventDispatcher()
  var enabledCommands = emptySet<String>()

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (
      event.action == KeyEvent.ACTION_DOWN &&
      event.repeatCount == 0 &&
      event.isCtrlPressed &&
      event.isAltPressed &&
      !event.isShiftPressed
    ) {
      val command = when (event.keyCode) {
        KeyEvent.KEYCODE_LEFT_BRACKET -> "organizationWorkspace.previous"
        KeyEvent.KEYCODE_RIGHT_BRACKET -> "organizationWorkspace.next"
        KeyEvent.KEYCODE_W -> "organizationWorkspace.picker"
        else -> null
      }
      if (command != null && enabledCommands.contains(command)) {
        onCommand(mapOf("command" to command))
        return true
      }
      if (event.keyCode in KeyEvent.KEYCODE_1..KeyEvent.KEYCODE_9) {
        val command = "organizationWorkspace.jump.${event.keyCode - KeyEvent.KEYCODE_1 + 1}"
        if (enabledCommands.contains(command)) {
          onCommand(mapOf("command" to command))
          return true
        }
      }
    }
    val copiesThreadReference =
      event.action == KeyEvent.ACTION_DOWN &&
        event.repeatCount == 0 &&
        event.keyCode == KeyEvent.KEYCODE_C &&
        event.isCtrlPressed &&
        event.isShiftPressed &&
        !event.isAltPressed &&
        enabledCommands.contains("copyThreadReference")
    if (copiesThreadReference) {
      onCommand(mapOf("command" to "copyThreadReference"))
      return true
    }
    return super.dispatchKeyEvent(event)
  }
}
