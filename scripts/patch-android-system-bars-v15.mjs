import fs from 'node:fs'
import path from 'node:path'

const MARKER = 'DFL_FINANCE_SYSTEM_BARS_V29_VAULT_DONOR'

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

if (
  source.includes('DFL_FINANCE_SYSTEM_BARS_V14_8') ||
  source.includes('DFL_FINANCE_EDGE_TO_EDGE_V14_7')
) {
  throw new Error(
    'MainActivity já contém cirurgia DFL antiga antes do patch V15'
  )
}

if (source.includes(MARKER)) {
  console.log('DFL Finance V15 já aplicado:', file)
  process.exit(0)
}

if (file.endsWith('.java')) {
  if (!source.includes('import android.os.Bundle;')) {
    source = source.replace(
      /package ([^;]+);\s*/,
      (match) =>
        `${match}\n` +
        'import android.os.Bundle;\n' +
        'import android.graphics.Color;\n' +
        'import androidx.core.view.WindowCompat;\n'
    )
  } else {
    if (!source.includes('import android.graphics.Color;')) {
      source = source.replace(
        'import android.os.Bundle;',
        'import android.os.Bundle;\nimport android.graphics.Color;'
      )
    }

    if (!source.includes('import androidx.core.view.WindowCompat;')) {
      source = source.replace(
        'import android.os.Bundle;',
        'import android.os.Bundle;\nimport androidx.core.view.WindowCompat;'
      )
    }
  }

  source = source.replace(
    /public class MainActivity extends BridgeActivity \{\s*/,
    `public class MainActivity extends BridgeActivity {
  // ${MARKER}
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WindowCompat.setDecorFitsSystemWindows(
      getWindow(),
      false
    );

    getWindow().setStatusBarColor(
      Color.TRANSPARENT
    );

    getWindow().setNavigationBarColor(
      Color.TRANSPARENT
    );

    WindowCompat
      .getInsetsController(
        getWindow(),
        getWindow().getDecorView()
      )
      .setAppearanceLightStatusBars(false);
  }

`
  )
} else {
  if (!source.includes('import android.os.Bundle')) {
    source = source.replace(
      /package ([^\n]+)\n/,
      (match) =>
        `${match}\n` +
        'import android.os.Bundle\n' +
        'import android.graphics.Color\n' +
        'import androidx.core.view.WindowCompat\n'
    )
  } else {
    if (!source.includes('import android.graphics.Color')) {
      source = source.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport android.graphics.Color'
      )
    }

    if (!source.includes('import androidx.core.view.WindowCompat')) {
      source = source.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport androidx.core.view.WindowCompat'
      )
    }
  }

  source = source.replace(
    /class MainActivity\s*:\s*BridgeActivity\(\)\s*\{\s*/,
    `class MainActivity : BridgeActivity() {
    // ${MARKER}
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(
            window,
            false
        )

        window.statusBarColor =
            Color.TRANSPARENT

        window.navigationBarColor =
            Color.TRANSPARENT

        WindowCompat
            .getInsetsController(
                window,
                window.decorView
            )
            .isAppearanceLightStatusBars = false
    }

`
  )
}

if (!source.includes(MARKER)) {
  throw new Error('Patch V15 não pôde ser aplicado à MainActivity')
}

if (!source.includes('setDecorFitsSystemWindows')) {
  throw new Error('Contrato edge-to-edge ausente')
}

if (!source.includes('Color.TRANSPARENT')) {
  throw new Error('Contrato de barras transparentes ausente')
}

if (
  !source.includes('setAppearanceLightStatusBars(false)') &&
  !source.includes('isAppearanceLightStatusBars = false')
) {
  throw new Error('Contrato de ícones claros ausente')
}

const classBody = source.slice(source.indexOf(MARKER))

if (/\bonResume\s*\(/.test(classBody)) {
  throw new Error('V15 não permite onResume para System Bars')
}

if (/\bonWindowFocusChanged\s*\(/.test(classBody)) {
  throw new Error(
    'V15 não permite onWindowFocusChanged para System Bars'
  )
}

fs.writeFileSync(file, source)

console.log(
  'DFL Finance V15 — autoridade nativa única aplicada:',
  file
)
