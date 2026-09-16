import fs from 'node:fs'
import path from 'node:path'

const MARKER = 'DFL_FINANCE_EDGE_TO_EDGE_V14_7'

function walk(dir) {
  if (!fs.existsSync(dir)) return []

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)

    return entry.isDirectory()
      ? walk(file)
      : [file]
  })
}

const file = walk('android/app/src/main/java')
  .find((candidate) => /MainActivity\.(java|kt)$/.test(candidate))

if (!file) {
  throw new Error('MainActivity Android não encontrada')
}

let source = fs.readFileSync(file, 'utf8')

if (source.includes(MARKER)) {
  console.log('V14.7 edge-to-edge já aplicado:', file)
  process.exit(0)
}

if (file.endsWith('.java')) {
  if (!source.includes('android.os.Bundle')) {
    source = source.replace(
      /package ([^;]+);\s*/,
      (match) =>
        `${match}\n` +
        'import android.os.Bundle;\n' +
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

  source = source.replace(
    /public class MainActivity extends BridgeActivity \{\s*/,
    `public class MainActivity extends BridgeActivity {
  // ${MARKER}
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);

    WindowCompat
      .getInsetsController(getWindow(), getWindow().getDecorView())
      .setAppearanceLightStatusBars(false);
  }

`
  )
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

  source = source.replace(
    /class MainActivity\s*:\s*BridgeActivity\(\)\s*\{\s*/,
    `class MainActivity : BridgeActivity() {
    // ${MARKER}
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        WindowCompat
            .getInsetsController(window, window.decorView)
            .isAppearanceLightStatusBars = false
    }

`
  )
}

if (!source.includes(MARKER)) {
  throw new Error('Patch edge-to-edge não pôde ser aplicado à MainActivity')
}

if (!source.includes('setDecorFitsSystemWindows')) {
  throw new Error('setDecorFitsSystemWindows ausente após patch')
}

if (!source.includes('Color.TRANSPARENT')) {
  throw new Error('barras transparentes ausentes após patch')
}

fs.writeFileSync(file, source)

console.log('DFL Finance V14.7 edge-to-edge aplicado:', file)
