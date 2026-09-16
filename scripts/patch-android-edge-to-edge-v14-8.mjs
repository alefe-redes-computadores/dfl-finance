import fs from 'node:fs'
import path from 'node:path'

const MARKER = 'DFL_FINANCE_SYSTEM_BARS_V14_8'

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(dir, entry.name))
          : [path.join(dir, entry.name)]
      )
    : []

const file = walk('android/app/src/main/java').find((candidate) =>
  /MainActivity\.(java|kt)$/.test(candidate)
)

if (!file) {
  throw new Error('MainActivity Android não encontrada')
}

let source = fs.readFileSync(file, 'utf8')

/*
 * Remove a cirurgia V14.7 caso o template/arquivo já a contenha.
 * No CI atual o Android nasce limpo, mas isso mantém o patch idempotente.
 */
source = source.replace(
  /\s*\/\/ DFL_FINANCE_EDGE_TO_EDGE_V14_7[\s\S]*?(?=\n\s*(?:public|private|protected|@Override|\}))/,
  '\n'
)

if (file.endsWith('.java')) {
  if (!source.includes('android.os.Bundle')) {
    source = source.replace(
      /package ([^;]+);\s*/,
      (match) =>
        `${match}\nimport android.os.Bundle;\n` +
        'import android.graphics.Color;\n' +
        'import androidx.core.view.WindowCompat;\n'
    )
  } else {
    if (!source.includes('android.graphics.Color')) {
      source = source.replace(
        'import android.os.Bundle;',
        'import android.os.Bundle;\nimport android.graphics.Color;'
      )
    }

    if (!source.includes('androidx.core.view.WindowCompat')) {
      source = source.replace(
        'import android.os.Bundle;',
        'import android.os.Bundle;\nimport androidx.core.view.WindowCompat;'
      )
    }
  }

  if (!source.includes(MARKER)) {
    source = source.replace(
      /public class MainActivity extends BridgeActivity \{\s*/,
      `public class MainActivity extends BridgeActivity {
  // ${MARKER}

  private void applySystemBars() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);

    WindowCompat
      .getInsetsController(getWindow(), getWindow().getDecorView())
      .setAppearanceLightStatusBars(false);
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    applySystemBars();
  }

  @Override
  protected void onResume() {
    super.onResume();
    applySystemBars();
  }

`
    )
  }
} else {
  if (!source.includes('android.os.Bundle')) {
    source = source.replace(
      /package ([^\n]+)\n/,
      (match) =>
        `${match}\n` +
        'import android.os.Bundle\n' +
        'import android.graphics.Color\n' +
        'import androidx.core.view.WindowCompat\n'
    )
  } else {
    if (!source.includes('android.graphics.Color')) {
      source = source.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport android.graphics.Color'
      )
    }

    if (!source.includes('androidx.core.view.WindowCompat')) {
      source = source.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport androidx.core.view.WindowCompat'
      )
    }
  }

  if (!source.includes(MARKER)) {
    source = source.replace(
      /class MainActivity\s*:\s*BridgeActivity\(\)\s*\{\s*/,
      `class MainActivity : BridgeActivity() {
    // ${MARKER}

    private fun applySystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        WindowCompat
            .getInsetsController(window, window.decorView)
            .isAppearanceLightStatusBars = false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applySystemBars()
    }

    override fun onResume() {
        super.onResume()
        applySystemBars()
    }

`
    )
  }
}

const required = [
  MARKER,
  'setDecorFitsSystemWindows',
  'Color.TRANSPARENT',
  'applySystemBars',
  'onResume',
]

for (const contract of required) {
  if (!source.includes(contract)) {
    throw new Error(`Contrato nativo ausente após patch: ${contract}`)
  }
}

if (
  !source.includes('setAppearanceLightStatusBars(false)') &&
  !source.includes('isAppearanceLightStatusBars = false')
) {
  throw new Error('Contrato de ícones claros ausente')
}

fs.writeFileSync(file, source)

console.log('DFL Finance V14.8 system bars aplicado:', file)
