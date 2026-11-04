package ph.edu.umak.crm.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.nio.ByteBuffer
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Ciphertext is excluded from Auto Backup by residing in noBackupFilesDir. */
class SessionVault(context: Context) {
    private val file = AtomicFile(File(context.noBackupFilesDir, "crm-session-v1"))
    private val alias = "crm.session.aes256.v1"
    private fun key(create: Boolean): SecretKey? {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        if (!create) return null
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).setKeySize(256).build())
        }.generateKey()
    }
    @Synchronized fun save(secret: String) {
        require(secret.toByteArray(Charsets.UTF_8).size in 1..4096)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key(true)) // Provider creates a fresh random IV.
        cipher.updateAAD(alias.toByteArray(Charsets.UTF_8))
        val encrypted = cipher.doFinal(secret.toByteArray(Charsets.UTF_8))
        val stream = file.startWrite()
        try {
            stream.write(ByteBuffer.allocate(4 + cipher.iv.size + encrypted.size).putInt(1).put(cipher.iv).put(encrypted).array())
            file.finishWrite(stream)
        } catch (error: Exception) { file.failWrite(stream); throw error }
    }
    @Synchronized fun read(): String? = try {
        val bytes = file.readFully()
        require(bytes.size in 33..8192)
        val buffer = ByteBuffer.wrap(bytes)
        require(buffer.int == 1)
        val iv = ByteArray(12).also { buffer.get(it) }
        val encrypted = ByteArray(buffer.remaining()).also { buffer.get(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(false) ?: error("Key unavailable"), GCMParameterSpec(128, iv))
        cipher.updateAAD(alias.toByteArray(Charsets.UTF_8))
        String(cipher.doFinal(encrypted), Charsets.UTF_8)
    } catch (_: Exception) { clear(); null } // Lost/invalid key or modified ciphertext requires sign-in.
    @Synchronized fun clear() {
        file.delete()
        KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry(alias) }
    }
}
