package ph.edu.umak.crm

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.room.Room
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import ph.edu.umak.crm.cache.PublicDatabase
import ph.edu.umak.crm.cache.PublicItem
import ph.edu.umak.crm.security.SessionVault
import java.io.File

@RunWith(AndroidJUnit4::class)
class SecurityCacheTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    @Test fun keystoreCiphertextTamperAndLogoutRequireSignIn() {
        val vault = SessionVault(context)
        vault.clear()
        vault.save("synthetic-token")
        assertEquals("synthetic-token", vault.read())
        val file = File(context.noBackupFilesDir, "crm-session-v1")
        val bytes = file.readBytes()
        assertFalse(String(bytes, Charsets.ISO_8859_1).contains("synthetic-token"))
        bytes[bytes.lastIndex] = (bytes.last().toInt() xor 1).toByte()
        file.writeBytes(bytes)
        assertNull(vault.read())
        vault.save("synthetic-token")
        vault.clear()
        assertNull(vault.read())
    }
    @Test fun roomPublicCacheSurvivesDatabaseReopenWithoutNetwork() {
        val name = "crm-instrumented-cache.db"
        context.deleteDatabase(name)
        fun open() = Room.databaseBuilder(context, PublicDatabase::class.java, name).build()
        val first = open()
        try { first.content().replace(listOf(PublicItem("directory", "directory", "CRM", "Public demo", "v1", 1, null))) }
        finally { first.close() }
        val reopened = open()
        try { assertEquals("Public demo", reopened.content().list().single().text) }
        finally { reopened.close() }
        context.deleteDatabase(name)
    }
}
