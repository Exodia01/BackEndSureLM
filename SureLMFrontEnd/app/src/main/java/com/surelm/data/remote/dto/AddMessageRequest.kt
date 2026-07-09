import com.surelm.data.remote.dto.AddMessageRequestDto

data class AddMessageRequest(
    val leadId: String,
    val role: String,  // "agent", "ai"
    val content: String
)
