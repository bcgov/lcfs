import QueueIcon from '@mui/icons-material/Queue'
import IconButton from '@mui/material/IconButton'


export const ActionsRenderer = (props) => {

  return (
    <div>
      <IconButton
        aria-label="duplicate"
        color="primary"
        onClick={() => props.onDuplicate(props)}
      >
        <QueueIcon
          sx={{
            transform: 'scaleX(-1)'
          }}
        />
      </IconButton>
    </div>
  )
}
ActionsRenderer.displayName = 'ActionsRenderer'
